import { readFileSync, writeFileSync } from 'node:fs';

// Build in CI without exposing the private signing key. Sign the APK locally.
const file = new URL('../android/app/build.gradle', import.meta.url);
let gradle = readFileSync(file, 'utf8');
const proguardFile = new URL('../android/app/proguard-rules.pro', import.meta.url);
const proguard = readFileSync(proguardFile, 'utf8');
const marker = '// CampusLink: release APK is signed locally after download.';
if (!gradle.includes(marker)) {
  if (!/release \{[\s\S]*?signingConfig signingConfigs\.debug/.test(gradle)) {
    throw new Error('Unsupported Android signing template');
  }
  gradle = gradle.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1' + marker);
  writeFileSync(file, gradle);
}

// Expo SDK 58's GLView is created by reflection; C++ resolves flush() by name.
// Apply after every prebuild, including projects already configured for signing.
// Upstream: https://github.com/expo/expo/pull/51951
const glRules = `# CampusLink: preserve expo-gl reflection and JNI entrypoints.
-keepclassmembers class expo.modules.gl.GLView {
    public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

-keepclassmembers class expo.modules.gl.GLContext {
    public void flush();
}`;
if (!proguard.includes(glRules)) writeFileSync(proguardFile, proguard.trimEnd() + '\n\n' + glRules + '\n');
