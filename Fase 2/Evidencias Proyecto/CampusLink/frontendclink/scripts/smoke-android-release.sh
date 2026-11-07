#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke-results
sdk_bin=$(dirname "$(find "$ANDROID_HOME/cmdline-tools" -type f -name sdkmanager | sort -V | tail -n 1)")
export PATH="$sdk_bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
command -v sdkmanager
command -v avdmanager
echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --name-match=kvm
if ! sdkmanager "system-images;android-$QA_API;google_apis;x86_64" 'platform-tools' 'emulator' > smoke-results/sdk-install.log 2>&1; then
  cat smoke-results/sdk-install.log
  exit 1
fi
export ANDROID_AVD_HOME="$RUNNER_TEMP/campuslink-avds"
mkdir -p "$ANDROID_AVD_HOME"
echo no | avdmanager create avd --force --name campuslink-qa --path "$ANDROID_AVD_HOME/campuslink-qa.avd" --package "system-images;android-$QA_API;google_apis;x86_64"
test -s "$ANDROID_AVD_HOME/campuslink-qa.avd/config.ini"
if [ ! -f "$ANDROID_AVD_HOME/campuslink-qa.ini" ]; then
  printf 'avd.ini.encoding=UTF-8\npath=%s\ntarget=android-%s\n' "$ANDROID_AVD_HOME/campuslink-qa.avd" "$QA_API" > "$ANDROID_AVD_HOME/campuslink-qa.ini"
fi
"$ANDROID_HOME/emulator/emulator" -list-avds | tee smoke-results/avds.txt
grep -Fxq campuslink-qa smoke-results/avds.txt
"$ANDROID_HOME/emulator/emulator" -avd campuslink-qa -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader -camera-back none -accel on > smoke-results/emulator.log 2>&1 &
emulator_pid=$!
adb start-server
booted=false
for attempt in $(seq 1 150); do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then tail -n 80 smoke-results/emulator.log; exit 1; fi
  if [ "$(timeout 5 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = '1' ]; then booted=true; break; fi
  sleep 2
done
if [ "$booted" != true ]; then tail -n 80 smoke-results/emulator.log; exit 1; fi
apk=$(find android-artifact -name '*-unsigned.apk' -print -quit)
test -n "$apk"
# Emulator-only copy: debug signing allows installation of the CI unsigned APK.
keytool -genkeypair -keystore "$RUNNER_TEMP/emulator.jks" -storepass android -keypass android \
  -alias androiddebugkey -dname 'CN=CI Emulator' -keyalg RSA -validity 7
build_tools=$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)
"$build_tools/apksigner" sign --ks "$RUNNER_TEMP/emulator.jks" --ks-pass pass:android --out "$RUNNER_TEMP/emulator.apk" "$apk"
adb install "$RUNNER_TEMP/emulator.apk"
adb logcat -c
adb shell am start -W -n cl.campuslink.app/.MainActivity
sleep 20
adb shell pidof cl.campuslink.app > smoke-results/app-pid.txt
test -s smoke-results/app-pid.txt
adb logcat -b crash -d > smoke-results/crash.log
if grep -Eq 'FATAL EXCEPTION|Fatal signal' smoke-results/crash.log; then cat smoke-results/crash.log; exit 1; fi
adb exec-out screencap -p > smoke-results/startup.png
printf 'Release startup passed on Android API %s (x86_64 emulator). Map/authenticated flows not exercised by this smoke test.\n' "$QA_API" > smoke-results/RESULT.txt
