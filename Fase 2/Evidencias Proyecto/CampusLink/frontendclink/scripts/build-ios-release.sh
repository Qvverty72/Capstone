#!/usr/bin/env bash
set -euo pipefail

# No Apple credentials are used on CI. Sign the device IPA locally on Windows.
mkdir -p artifacts-ios
workspace=$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)
test -n "$workspace"
archive="$RUNNER_TEMP/CampusLink-device.xcarchive"
if ! xcodebuild -workspace "$workspace" -scheme CampusLink -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -archivePath "$archive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO COMPILER_INDEX_STORE_ENABLE=NO \
  archive > artifacts-ios/device-build.log 2>&1; then
  tail -n 100 artifacts-ios/device-build.log
  exit 1
fi
app="$archive/Products/Applications/CampusLink.app"
test -d "$app"
test -s "$app/main.jsbundle"
plist="$app/Info.plist"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")" = 'cl.campuslink.app'
version=$(node -p "require('./app.json').expo.version")
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")" = "$version"
executable=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")
xcrun lipo -archs "$app/$executable" | grep -qw arm64
test -n "$(find "$app" -name '*.glb' -print -quit)"
minimum=$(/usr/libexec/PlistBuddy -c 'Print :MinimumOSVersion' "$plist")
mkdir -p "$RUNNER_TEMP/ipa-package/Payload"
cp -R "$app" "$RUNNER_TEMP/ipa-package/Payload/"
ipa="CampusLink-$version-iphone-unsigned.ipa"
(cd "$RUNNER_TEMP/ipa-package" && ditto -c -k --keepParent Payload "$OLDPWD/artifacts-ios/$ipa")
printf 'CampusLink %s\nSource: %s\nAPI: %s\nMinimum iOS: %s\nArchitecture: arm64 (physical iPhone/iPad, not Simulator)\nUnsigned IPA: install and sign with Sideloadly on Windows using your own free Apple account.\nFree signatures expire after 7 days and must be renewed.\nNo Apple account or password was provided to CI.\n' "$version" "$GITHUB_SHA" "$EXPO_PUBLIC_API_URL" "$minimum" > artifacts-ios/BUILD.txt
(cd artifacts-ios && shasum -a 256 "$ipa" > SHA256SUMS.txt)
tail -n 8 artifacts-ios/device-build.log
cat artifacts-ios/BUILD.txt
