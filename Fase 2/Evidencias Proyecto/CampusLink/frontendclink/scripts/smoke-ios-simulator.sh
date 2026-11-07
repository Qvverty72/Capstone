#!/usr/bin/env bash
set -euo pipefail

workspace=$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)
derived="$RUNNER_TEMP/CampusLink-simulator"
if ! xcodebuild -workspace "$workspace" -scheme CampusLink -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$derived" \
  CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO \
  build > artifacts-ios/simulator-build.log 2>&1; then
  tail -n 100 artifacts-ios/simulator-build.log
  exit 1
fi
app="$derived/Build/Products/Release-iphonesimulator/CampusLink.app"
# Apple Silicon simulators can require an ad hoc signature; no Apple account.
codesign --force --deep --sign - "$app"
xcrun simctl list devices available --json > artifacts-ios/simulator-devices.json
python3 - <<'PY' > "$RUNNER_TEMP/iphone-test-devices.txt"
import json
data=json.load(open('artifacts-ios/simulator-devices.json'))
devices=[d for group in data['devices'].values() for d in group if d['name'].startswith('iPhone') and d.get('isAvailable')]
if len(devices)<2:raise SystemExit('Need two available iPhone simulators')
small=next((d for d in devices if 'SE' in d['name']),devices[0])
large=next((d for d in devices if 'Pro Max' in d['name'] and d['udid']!=small['udid']),next(d for d in devices if d['udid']!=small['udid']))
for d in [small,large]:print(d['udid'])
PY
while IFS= read -r device; do
  state=$(xcrun simctl list devices --json | python3 -c 'import json,sys;print(next(d["state"] for group in json.load(sys.stdin)["devices"].values() for d in group if d["udid"]==sys.argv[1]))' "$device")
  if [ "$state" != 'Booted' ]; then xcrun simctl boot "$device"; fi
  xcrun simctl bootstatus "$device" -b
  xcrun simctl install "$device" "$app"
  xcrun simctl launch --terminate-running-process "$device" cl.campuslink.app
  sleep 15
  xcrun simctl spawn "$device" launchctl list > "artifacts-ios/processes-$device.txt"
  awk '$1 ~ /^[1-9][0-9]*$/ && /UIKitApplication:cl.campuslink.app/ {found=1} END {exit !found}' "artifacts-ios/processes-$device.txt"
  xcrun simctl io "$device" screenshot "artifacts-ios/iphone-$device.png"
  xcrun simctl terminate "$device" cl.campuslink.app
  xcrun simctl shutdown "$device"
done < "$RUNNER_TEMP/iphone-test-devices.txt"
printf 'Release startup stayed alive on two iPhone simulators. Authenticated flows and map interaction require separate tests.\n' > artifacts-ios/SIMULATOR-SMOKE.txt
