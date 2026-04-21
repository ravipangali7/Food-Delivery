/// Subset of Django `SuperSetting` JSON used for forced app updates.
class StoreSettingsDto {
  const StoreSettingsDto({
    this.androidFile,
    this.googlePlaystoreLink,
    this.iosFile,
    this.applestoreLink,
    this.androidVersion,
    this.iosVersion,
  });

  final String? androidFile;
  final String? googlePlaystoreLink;
  final String? iosFile;
  final String? applestoreLink;
  final String? androidVersion;
  final String? iosVersion;

  factory StoreSettingsDto.fromJson(Map<String, dynamic> json) {
    return StoreSettingsDto(
      androidFile: json['android_file'] as String?,
      googlePlaystoreLink: json['google_playstore_link'] as String?,
      iosFile: json['ios_file'] as String?,
      applestoreLink: json['applestore_link'] as String?,
      androidVersion: json['android_version'] as String?,
      iosVersion: json['ios_version'] as String?,
    );
  }
}
