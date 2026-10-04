const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withRecorder(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    const permissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_PHONE_STATE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
      'moe.shizuku.manager.permission.API_V23',
    ];
    manifest['uses-permission'] ??= [];
    for (const name of permissions) {
      if (!manifest['uses-permission'].some((entry) => entry.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    // The prototype contains private audio. Backups must not upload it implicitly.
    const application = manifest.application[0];
    application.$['android:allowBackup'] = 'false';
    delete application.$['android:fullBackupContent'];
    delete application.$['android:dataExtractionRules'];
    return result;
  });
};
