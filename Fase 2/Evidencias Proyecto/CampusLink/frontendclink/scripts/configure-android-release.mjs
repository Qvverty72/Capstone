import { readFileSync, writeFileSync } from 'node:fs';

// Build in CI without exposing the private signing key. Sign the APK locally.
const file = new URL('../android/app/build.gradle', import.meta.url);
let gradle = readFileSync(file, 'utf8');
const marker = '// CampusLink: release APK is signed locally after download.';
if (gradle.includes(marker)) process.exit(0);
if (!/release \{[\s\S]*?signingConfig signingConfigs\.debug/.test(gradle)) {
  throw new Error('Unsupported Android signing template');
}
gradle = gradle.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1' + marker);
writeFileSync(file, gradle);
