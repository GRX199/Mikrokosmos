/**
 * with-fcm — Expo config plugin: wires Firebase Cloud Messaging into the
 * bare android project at prebuild time.
 *
 * google-services.json (project root) is NOT handled automatically by
 * expo-notifications in SDK 57, so this plugin:
 *   1. copies google-services.json  root → android/app/
 *   2. adds the google-services gradle classpath (root build.gradle)
 *   3. applies the plugin in android/app/build.gradle
 *
 * Without this, getExpoPushTokenAsync() returns no FCM device token and
 * Android push silently fails.
 */
const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
} = require('expo/config-plugins');

const APPLY_LINE = 'apply plugin: "com.google.gms.google-services"';
const CLASSPATH_LINE = "classpath('com.google.gms:google-services:4.4.2')";

function withClasspath(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('google-services')) {
      cfg.modResults.contents = src.replace(
        /dependencies\s*\{/,
        `dependencies {\n    // FCM (Firebase Cloud Messaging)\n    ${CLASSPATH_LINE}`
      );
    }
    return cfg;
  });
}

function withApplyPlugin(config) {
  return withAppBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('com.google.gms.google-services')) {
      cfg.modResults.contents = src.replace(
        /apply plugin: "com\.facebook\.react"/,
        `apply plugin: "com.facebook.react"\n// FCM (Firebase Cloud Messaging) — processes google-services.json.\n${APPLY_LINE}`
      );
    }
    return cfg;
  });
}

function withCopyGoogleServicesJson(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const { projectRoot } = cfg.modRequest;
      const src = path.join(projectRoot, 'google-services.json');
      if (fs.existsSync(src)) {
        const dest = path.join(projectRoot, 'android', 'app', 'google-services.json');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
      return cfg;
    },
  ]);
}

module.exports = (config) =>
  withCopyGoogleServicesJson(withApplyPlugin(withClasspath(config)));
