import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:city_water_flutter/config/api_config.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;
import 'package:permission_handler/permission_handler.dart';

class MeterScanScreen extends StatefulWidget {
  const MeterScanScreen({super.key});

  @override
  State<MeterScanScreen> createState() => _MeterScanScreenState();
}

class _MeterScanScreenState extends State<MeterScanScreen> {
  static const double _minRegionWidth = 0.45;
  static const double _minRegionHeight = 0.18;

  CameraController? _cameraController;
  final TextRecognizer _textRecognizer = TextRecognizer(
    script: TextRecognitionScript.latin,
  );

  final TextEditingController _meterNumberController = TextEditingController();
  final TextEditingController _meterReadingController = TextEditingController();

  bool _isCameraReady = false;
  bool _isProcessing = false;
  bool _isSubmitting = false;
  bool _autoCaptureEnabled = true;
  bool _captured = false;
  bool _imageStreamRunning = false;
  bool _autoCaptureTriggered = false;

  String _rawText = '';
  String _confidence = 'low';
  String? _cameraError;
  String? _qualityMessage;

  Rect _scanRegion = const Rect.fromLTWH(0.16, 0.33, 0.68, 0.24);
  double _latestSharpness = 0;
  double _latestBrightness = 0;

  final List<_FrameStats> _recentFrameStats = <_FrameStats>[];
  List<Rect> _detectedDigitBoxes = <Rect>[];

  int _captureCounter = 0;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    final status = await Permission.camera.request();

    if (!status.isGranted) {
      if (!mounted) {
        return;
      }
      setState(() {
        _cameraError = 'Camera permission is required to scan the meter.';
      });
      return;
    }

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        setState(() {
          _cameraError = 'No camera found on this device.';
        });
        return;
      }

      final selectedCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        selectedCamera,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.yuv420,
      );

      await _cameraController!.initialize();
      await _cameraController!.setFocusMode(FocusMode.auto);
      await _cameraController!.setExposureMode(ExposureMode.auto);
      await _cameraController!.setFlashMode(FlashMode.off);

      if (!mounted) {
        return;
      }

      setState(() {
        _isCameraReady = true;
      });

      _startImageStream();
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _cameraError = 'Failed to initialize camera: $e';
      });
    }
  }

  @override
  void dispose() {
    _meterNumberController.dispose();
    _meterReadingController.dispose();
    _cameraController?.dispose();
    _textRecognizer.close();
    super.dispose();
  }

  Future<void> _startImageStream() async {
    if (_cameraController == null || !_isCameraReady || _imageStreamRunning) {
      return;
    }

    try {
      await _cameraController!.startImageStream((CameraImage image) {
        if (!_autoCaptureEnabled || _captured || _isProcessing) {
          return;
        }

        final stats = _computeFrameStats(image);
        _latestBrightness = stats.brightness;
        _latestSharpness = stats.sharpness;
        _recentFrameStats.add(stats);
        if (_recentFrameStats.length > 15) {
          _recentFrameStats.removeAt(0);
        }

        if (_shouldAutoCapture() && !_autoCaptureTriggered) {
          _autoCaptureTriggered = true;
          unawaited(_captureAndProcess(autoTriggered: true));
        }

        if (mounted) {
          setState(() {});
        }
      });
      _imageStreamRunning = true;
    } catch (_) {
      _imageStreamRunning = false;
    }
  }

  Future<void> _stopImageStream() async {
    if (_cameraController == null || !_imageStreamRunning) {
      return;
    }

    try {
      await _cameraController!.stopImageStream();
    } catch (_) {
      // Ignore stop stream failures and continue with best effort.
    }
    _imageStreamRunning = false;
  }

  _FrameStats _computeFrameStats(CameraImage image) {
    final bytes = image.planes.first.bytes;
    if (bytes.isEmpty) {
      return const _FrameStats(brightness: 0, sharpness: 0);
    }

    double brightnessSum = 0;
    double gradientSum = 0;

    for (var i = 1; i < bytes.length; i += 16) {
      final current = bytes[i].toDouble();
      final previous = bytes[i - 1].toDouble();
      brightnessSum += current;
      gradientSum += (current - previous).abs();
    }

    final sampleCount = math.max(1, (bytes.length / 16).floor());
    final avgBrightness = brightnessSum / sampleCount;
    final avgGradient = gradientSum / sampleCount;
    return _FrameStats(brightness: avgBrightness, sharpness: avgGradient);
  }

  bool _shouldAutoCapture() {
    if (_recentFrameStats.length < 8) {
      return false;
    }

    final sharpnessValues = _recentFrameStats.map((e) => e.sharpness).toList();
    final brightnessValues = _recentFrameStats
        .map((e) => e.brightness)
        .toList();

    final avgSharpness =
        sharpnessValues.reduce((a, b) => a + b) / sharpnessValues.length;
    final avgBrightness =
        brightnessValues.reduce((a, b) => a + b) / brightnessValues.length;

    double variation = 0;
    for (final value in sharpnessValues) {
      variation += (value - avgSharpness) * (value - avgSharpness);
    }
    final stdDev = math.sqrt(variation / sharpnessValues.length);

    final isSharp = avgSharpness > 11;
    final isStable = stdDev < 4.5;
    final brightnessOk = avgBrightness > 70 && avgBrightness < 200;
    return isSharp && isStable && brightnessOk;
  }

  Future<_ProcessedImageData> _preProcessImage(String sourcePath) async {
    final bytes = await File(sourcePath).readAsBytes();
    final original = img.decodeImage(bytes);
    if (original == null) {
      return _ProcessedImageData(path: sourcePath, width: 1000, height: 1000);
    }

    final crop = _normalizedRegionToImageRect(
      _scanRegion,
      original.width,
      original.height,
    );

    final cropped = img.copyCrop(
      original,
      x: crop.left.round(),
      y: crop.top.round(),
      width: crop.width.round(),
      height: crop.height.round(),
    );

    final avgLuma = _averageLuma(cropped);
    final target = 128.0;
    final brightnessOffset = ((target - avgLuma) * 0.7).clamp(-45.0, 45.0);

    final enhanced = img.adjustColor(
      cropped,
      brightness: brightnessOffset,
      contrast: 1.18,
    );

    final gray = img.grayscale(enhanced);
    final denoised = img.gaussianBlur(gray, radius: 1);

    final sharpened = img.convolution(
      denoised,
      filter: <num>[0, -1, 0, -1, 5, -1, 0, -1, 0],
      div: 1,
      offset: 0,
    );

    final outputPath =
        '${Directory.systemTemp.path}${Platform.pathSeparator}meter_scan_${DateTime.now().millisecondsSinceEpoch}_${_captureCounter++}.jpg';
    await File(outputPath).writeAsBytes(img.encodeJpg(sharpened, quality: 96));
    return _ProcessedImageData(
      path: outputPath,
      width: sharpened.width,
      height: sharpened.height,
    );
  }

  double _averageLuma(img.Image image) {
    var sum = 0.0;
    var count = 0;
    for (var y = 0; y < image.height; y += 3) {
      for (var x = 0; x < image.width; x += 3) {
        final pixel = image.getPixel(x, y);
        sum += img.getLuminance(pixel);
        count++;
      }
    }
    return count == 0 ? 0 : sum / count;
  }

  _ExtractedScanResult _extractDigits(
    RecognizedText recognizedText,
    int imageWidth,
    int imageHeight,
  ) {
    final digitElements = <_DigitElement>[];

    for (final block in recognizedText.blocks) {
      for (final line in block.lines) {
        for (final element in line.elements) {
          final digits = element.text.replaceAll(RegExp(r'[^0-9]'), '');
          if (digits.isEmpty) {
            continue;
          }
          final box = element.boundingBox;
          digitElements.add(_DigitElement(digits: digits, box: box));
        }
      }
    }

    digitElements.sort((a, b) {
      final vertical = (a.box.top - b.box.top).abs();
      if (vertical > 12) {
        return a.box.top.compareTo(b.box.top);
      }
      return a.box.left.compareTo(b.box.left);
    });

    final candidates = <String>[];
    final boxes = <Rect>[];

    for (final element in digitElements) {
      final matches = RegExp(r'\d{5}').allMatches(element.digits);
      for (final match in matches) {
        if (candidates.length >= 2) {
          break;
        }
        candidates.add(match.group(0)!);
        boxes.add(
          Rect.fromLTWH(
            element.box.left / imageWidth,
            element.box.top / imageHeight,
            element.box.width / imageWidth,
            element.box.height / imageHeight,
          ),
        );
      }
      if (candidates.length >= 2) {
        break;
      }
    }

    if (candidates.length < 2) {
      final mergedDigits = recognizedText.text.replaceAll(
        RegExp(r'[^0-9]'),
        '',
      );
      final mergedMatches = RegExp(r'\d{5}').allMatches(mergedDigits).toList();
      if (mergedMatches.length >= 2) {
        candidates
          ..clear()
          ..add(mergedMatches[0].group(0)!)
          ..add(mergedMatches[1].group(0)!);
      }
    }

    final meterNumber = candidates.isNotEmpty ? candidates.first : '';
    final meterReading = candidates.length > 1 ? candidates[1] : '';

    final bothValid = _isFiveDigit(meterNumber) && _isFiveDigit(meterReading);
    final qualityScore = _qualityScore();
    final confidence = bothValid && qualityScore >= 0.62 ? 'high' : 'low';

    return _ExtractedScanResult(
      meterNumber: meterNumber,
      meterReading: meterReading,
      confidence: confidence,
      digitBoxes: boxes,
      rawText: recognizedText.text,
    );
  }

  double _qualityScore() {
    final sharpnessScore = (_latestSharpness / 18).clamp(0.0, 1.0);
    final brightnessDistance = (_latestBrightness - 128).abs();
    final brightnessScore = (1 - (brightnessDistance / 128)).clamp(0.0, 1.0);
    return (sharpnessScore * 0.65) + (brightnessScore * 0.35);
  }

  bool _isFiveDigit(String value) {
    return RegExp(r'^\d{5}$').hasMatch(value);
  }

  Future<void> _captureAndProcess({required bool autoTriggered}) async {
    if (_isProcessing || _cameraController == null || !_isCameraReady) {
      return;
    }

    setState(() {
      _isProcessing = true;
      _qualityMessage = null;
    });

    try {
      await _stopImageStream();
      final picture = await _cameraController!.takePicture();

      final processed = await _preProcessImage(picture.path);
      final inputImage = InputImage.fromFilePath(processed.path);
      final recognizedText = await _textRecognizer.processImage(inputImage);
      final extracted = _extractDigits(
        recognizedText,
        processed.width,
        processed.height,
      );

      final isValid =
          _isFiveDigit(extracted.meterNumber) &&
          _isFiveDigit(extracted.meterReading) &&
          extracted.confidence == 'high';

      setState(() {
        _captured = true;
        _autoCaptureEnabled = false;
        _rawText = extracted.rawText;
        _detectedDigitBoxes = extracted.digitBoxes;
        _confidence = extracted.confidence;
        _meterNumberController.text = extracted.meterNumber;
        _meterReadingController.text = extracted.meterReading;
        if (!isValid) {
          _qualityMessage =
              'Scan quality is low. Please rescan the meter clearly.';
        }
      });

      if (!isValid && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Scan quality is low. Please rescan the meter clearly.',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }

      if (autoTriggered && !isValid && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Auto scan did not pass validation. Please rescan.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('OCR Error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to scan meter: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  Future<void> _rescan() async {
    setState(() {
      _autoCaptureTriggered = false;
      _captured = false;
      _autoCaptureEnabled = true;
      _confidence = 'low';
      _rawText = '';
      _detectedDigitBoxes = <Rect>[];
      _qualityMessage = null;
      _meterNumberController.clear();
      _meterReadingController.clear();
    });
    await _startImageStream();
  }

  Future<void> _submit() async {
    final meterNumber = _meterNumberController.text.trim();
    final meterReading = _meterReadingController.text.trim();

    final isValid =
        _isFiveDigit(meterNumber) &&
        _isFiveDigit(meterReading) &&
        _confidence == 'high';
    if (!isValid) {
      setState(() {
        _qualityMessage =
            'Scan quality is low. Please rescan the meter clearly.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Scan quality is low. Please rescan the meter clearly.',
          ),
        ),
      );
      return;
    }

    final payload = <String, String>{
      'meter_number': meterNumber,
      'meter_reading': meterReading,
      'confidence': _confidence,
    };

    setState(() {
      _isSubmitting = true;
    });

    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/meter-readings');
      final response = await http
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 12));

      if (!mounted) {
        return;
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Meter data submitted successfully.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop(payload);
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Submit failed (${response.statusCode}). Please retry.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Network issue while submitting. Please retry.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Rect _normalizedRegionToImageRect(
    Rect normalized,
    int imageWidth,
    int imageHeight,
  ) {
    final left = (normalized.left * imageWidth).clamp(0.0, imageWidth - 2.0);
    final top = (normalized.top * imageHeight).clamp(0.0, imageHeight - 2.0);
    final width = (normalized.width * imageWidth).clamp(2.0, imageWidth - left);
    final height = (normalized.height * imageHeight).clamp(
      2.0,
      imageHeight - top,
    );

    return Rect.fromLTWH(left, top, width, height);
  }

  void _moveRegion(Offset delta, Size previewSize) {
    final dx = delta.dx / previewSize.width;
    final dy = delta.dy / previewSize.height;
    setState(() {
      final left = (_scanRegion.left + dx).clamp(0.0, 1.0 - _scanRegion.width);
      final top = (_scanRegion.top + dy).clamp(0.0, 1.0 - _scanRegion.height);
      _scanRegion = Rect.fromLTWH(
        left,
        top,
        _scanRegion.width,
        _scanRegion.height,
      );
    });
  }

  void _resizeRegion(Offset delta, Size previewSize) {
    final dw = delta.dx / previewSize.width;
    final dh = delta.dy / previewSize.height;
    setState(() {
      final width = (_scanRegion.width + dw).clamp(_minRegionWidth, 0.92);
      final height = (_scanRegion.height + dh).clamp(_minRegionHeight, 0.65);
      _scanRegion = Rect.fromLTWH(
        _scanRegion.left,
        _scanRegion.top,
        width,
        height,
      );

      if (_scanRegion.right > 1) {
        _scanRegion = Rect.fromLTWH(
          1 - _scanRegion.width,
          _scanRegion.top,
          _scanRegion.width,
          _scanRegion.height,
        );
      }

      if (_scanRegion.bottom > 1) {
        _scanRegion = Rect.fromLTWH(
          _scanRegion.left,
          1 - _scanRegion.height,
          _scanRegion.width,
          _scanRegion.height,
        );
      }
    });
  }

  Widget _buildScanOverlay(Size previewSize) {
    final left = previewSize.width * _scanRegion.left;
    final top = previewSize.height * _scanRegion.top;
    final width = previewSize.width * _scanRegion.width;
    final height = previewSize.height * _scanRegion.height;

    return Stack(
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _OverlayPainter(
                scanRect: Rect.fromLTWH(left, top, width, height),
              ),
            ),
          ),
        ),
        Positioned(
          left: left,
          top: top,
          width: width,
          height: height,
          child: GestureDetector(
            onPanUpdate: (details) => _moveRegion(details.delta, previewSize),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFF22C55E), width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  if (_detectedDigitBoxes.isNotEmpty)
                    Positioned.fill(
                      child: CustomPaint(
                        painter: _DigitBoxPainter(boxes: _detectedDigitBoxes),
                      ),
                    ),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: GestureDetector(
                      onPanUpdate: (details) =>
                          _resizeRegion(details.delta, previewSize),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: Color(0xFF22C55E),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(10),
                            bottomRight: Radius.circular(9),
                          ),
                        ),
                        child: const Icon(
                          Icons.open_in_full,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResultCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.74),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_qualityMessage != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red.shade300),
              ),
              child: Text(
                _qualityMessage!,
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _meterNumberController,
                  keyboardType: TextInputType.number,
                  maxLength: 5,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Meter Number',
                    labelStyle: TextStyle(color: Colors.white70),
                    counterStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white30),
                    ),
                    focusedBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white),
                    ),
                  ),
                  onChanged: (_) {
                    setState(() {});
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _meterReadingController,
                  keyboardType: TextInputType.number,
                  maxLength: 5,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Meter Reading',
                    labelStyle: TextStyle(color: Colors.white70),
                    counterStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white30),
                    ),
                    focusedBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white),
                    ),
                  ),
                  onChanged: (_) {
                    setState(() {});
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Confidence: ${_confidence.toUpperCase()}',
              style: TextStyle(
                color: _confidence == 'high'
                    ? Colors.greenAccent
                    : Colors.orangeAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isProcessing ? null : _rescan,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Rescan'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white38),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _submit,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 15,
                          height: 15,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.check),
                  label: const Text('Submit'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Raw OCR: $_rawText',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white54, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_cameraError != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Water Meter Scanner'),
          centerTitle: true,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _cameraError!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
          ),
        ),
      );
    }

    if (!_isCameraReady || _cameraController == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Water Meter Scanner'),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final previewSize = Size(
                  constraints.maxWidth,
                  constraints.maxHeight,
                );
                return Stack(
                  children: [
                    Positioned.fill(child: CameraPreview(_cameraController!)),
                    Positioned.fill(child: _buildScanOverlay(previewSize)),
                  ],
                );
              },
            ),
          ),
          if (_isProcessing)
            Positioned.fill(
              child: Container(
                color: Colors.black.withValues(alpha: 0.45),
                child: const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
              ),
            ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _captured
                ? _buildResultCard()
                : Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(18),
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Align digits in the box. Auto-capture runs when stable.',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Sharpness: ${_latestSharpness.toStringAsFixed(1)} | Brightness: ${_latestBrightness.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _isProcessing
                                    ? null
                                    : () => _captureAndProcess(
                                        autoTriggered: false,
                                      ),
                                icon: const Icon(Icons.camera_alt),
                                label: const Text('Scan Now'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _isProcessing
                                    ? null
                                    : () {
                                        setState(() {
                                          _autoCaptureEnabled =
                                              !_autoCaptureEnabled;
                                          _autoCaptureTriggered = false;
                                        });
                                        if (_autoCaptureEnabled) {
                                          _startImageStream();
                                        }
                                      },
                                icon: Icon(
                                  _autoCaptureEnabled
                                      ? Icons.pause_circle_outline
                                      : Icons.play_circle_outline,
                                  color: Colors.white,
                                ),
                                label: Text(
                                  _autoCaptureEnabled
                                      ? 'Auto: On'
                                      : 'Auto: Off',
                                  style: const TextStyle(color: Colors.white),
                                ),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Colors.white38),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  const _OverlayPainter({required this.scanRect});

  final Rect scanRect;

  @override
  void paint(Canvas canvas, Size size) {
    final overlay = Paint()..color = Colors.black.withValues(alpha: 0.45);
    final full = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final cutout = Path()
      ..addRRect(RRect.fromRectAndRadius(scanRect, const Radius.circular(12)));
    final result = Path.combine(PathOperation.difference, full, cutout);
    canvas.drawPath(result, overlay);
  }

  @override
  bool shouldRepaint(covariant _OverlayPainter oldDelegate) {
    return oldDelegate.scanRect != scanRect;
  }
}

class _DigitBoxPainter extends CustomPainter {
  const _DigitBoxPainter({required this.boxes});

  final List<Rect> boxes;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()
      ..color = Colors.yellow.withValues(alpha: 0.2)
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = Colors.yellow
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (final box in boxes) {
      final normalized = Rect.fromLTWH(
        box.left.clamp(0.0, 1.0),
        box.top.clamp(0.0, 1.0),
        box.width.clamp(0.0, 1.0),
        box.height.clamp(0.0, 1.0),
      );
      final target = Rect.fromLTWH(
        normalized.left * size.width,
        normalized.top * size.height,
        normalized.width * size.width,
        normalized.height * size.height,
      );
      canvas.drawRect(target, fill);
      canvas.drawRect(target, stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _DigitBoxPainter oldDelegate) {
    return oldDelegate.boxes != boxes;
  }
}

class _FrameStats {
  const _FrameStats({required this.brightness, required this.sharpness});

  final double brightness;
  final double sharpness;
}

class _DigitElement {
  const _DigitElement({required this.digits, required this.box});

  final String digits;
  final Rect box;
}

class _ExtractedScanResult {
  const _ExtractedScanResult({
    required this.meterNumber,
    required this.meterReading,
    required this.confidence,
    required this.digitBoxes,
    required this.rawText,
  });

  final String meterNumber;
  final String meterReading;
  final String confidence;
  final List<Rect> digitBoxes;
  final String rawText;
}

class _ProcessedImageData {
  const _ProcessedImageData({
    required this.path,
    required this.width,
    required this.height,
  });

  final String path;
  final int width;
  final int height;
}
