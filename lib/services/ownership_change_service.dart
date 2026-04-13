import 'dart:convert';

import 'package:city_water_flutter/config/api_config.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class OwnershipProfile {
  const OwnershipProfile({
    required this.email,
    required this.fullName,
    required this.meterNumber,
  });

  final String email;
  final String fullName;
  final String meterNumber;

  factory OwnershipProfile.fromMePayload(Map<String, dynamic> payload) {
    final metersRaw = payload['meters'];
    final meters = (metersRaw is List)
        ? metersRaw.whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    final meterNumber = meters.isEmpty
        ? ''
        : (meters.first['meterNumber']?.toString() ?? '');

    return OwnershipProfile(
      email: payload['email']?.toString() ?? '',
      fullName: payload['fullName']?.toString() ?? '',
      meterNumber: meterNumber,
    );
  }
}

class OwnershipChangeService {
  static Future<String> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('login_access_token') ?? '';
  }

  static Future<OwnershipProfile> fetchOwnershipProfile() async {
    final token = await _token();
    if (token.isEmpty) {
      throw Exception('Missing login token.');
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/me');
    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final decoded = _decodeBody(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_extractMessage(decoded, 'Failed to load profile.'));
    }

    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid profile response.');
    }

    final data = decoded['data'];
    if (data is! Map<String, dynamic>) {
      throw Exception('Profile data is unavailable.');
    }

    return OwnershipProfile.fromMePayload(data);
  }

  static Future<void> transferOwnership({
    required String currentOwnerEmail,
    required String meterNumber,
    required String newOwnerEmail,
    required String newOwnerNationalId,
    required String newOwnerPhoneE164,
    required String newOwnerFullName,
    required String newOwnerPassword,
  }) async {
    final token = await _token();
    if (token.isEmpty) {
      throw Exception('Missing login token.');
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}/auth/ownership-change');
    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'currentOwnerEmail': currentOwnerEmail,
        'meterNumber': meterNumber,
        'newOwnerEmail': newOwnerEmail,
        'newOwnerNationalId': newOwnerNationalId,
        'newOwnerPhoneE164': newOwnerPhoneE164,
        'newOwnerFullName': newOwnerFullName,
        'newOwnerPassword': newOwnerPassword,
      }),
    );

    final decoded = _decodeBody(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractMessage(decoded, 'Failed to transfer meter ownership.'),
      );
    }
  }

  static dynamic _decodeBody(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  static String _extractMessage(dynamic decoded, String fallback) {
    if (decoded is Map<String, dynamic>) {
      final message = decoded['message']?.toString().trim();
      if (message != null && message.isNotEmpty) {
        return message;
      }
    }
    return fallback;
  }
}
