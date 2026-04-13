import 'dart:convert';

import 'package:city_water_flutter/config/api_config.dart';
import 'package:city_water_flutter/services/location_service.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ComplaintLocation {
  const ComplaintLocation({
    required this.subCityId,
    required this.woredaId,
    required this.subCityName,
    required this.woredaName,
  });

  final String subCityId;
  final String woredaId;
  final String subCityName;
  final String woredaName;
}

class ComplaintService {
  static Future<String> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('login_access_token') ?? '';
  }

  static Future<ComplaintLocation> fetchRegisteredLocation() async {
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

    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (decoded is Map<String, dynamic>)
          ? (decoded['message']?.toString() ?? 'Failed to load profile data')
          : 'Failed to load profile data';
      throw Exception(message);
    }

    final payload = (decoded is Map<String, dynamic>)
        ? (decoded['data'] is Map<String, dynamic>
              ? decoded['data'] as Map<String, dynamic>
              : decoded)
        : <String, dynamic>{};

    final subCityId = payload['subCityId']?.toString() ?? '';
    final woredaId = payload['woredaId']?.toString() ?? '';

    if (subCityId.isEmpty || woredaId.isEmpty) {
      throw Exception('Your profile is missing sub city or woreda assignment.');
    }

    final subCities = await LocationService.fetchSubCities();
    final woredas = await LocationService.fetchWoredas(subCityId);

    final subCityName =
        subCities.firstWhere(
          (item) => item['id'] == subCityId,
          orElse: () => {'name': ''},
        )['name'] ??
        '';

    final woredaName =
        woredas.firstWhere(
          (item) => item['id'] == woredaId,
          orElse: () => {'name': ''},
        )['name'] ??
        '';

    return ComplaintLocation(
      subCityId: subCityId,
      woredaId: woredaId,
      subCityName: subCityName,
      woredaName: woredaName,
    );
  }
}
