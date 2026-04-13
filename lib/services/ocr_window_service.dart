import 'dart:convert';

import 'package:city_water_flutter/config/api_config.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class OcrWindowService {
  static Future<Map<String, dynamic>> getOcrWindowStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('login_access_token') ?? '';

    if (token.isEmpty) {
      return <String, dynamic>{
        'isConfigured': false,
        'isOpen': false,
        'isScheduled': false,
        'isClosed': true,
        'startDate': null,
        'closeDate': null,
      };
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/ocr-window-status');
    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      decoded = null;
    }

    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final data = decoded['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }

    throw Exception('Unable to load OCR window status.');
  }
}
