import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = new URL('../scripts/configure-android-release.mjs', import.meta.url);
const verifier = fileURLToPath(new URL('../scripts/verify-android-map-release.py', import.meta.url));
const marker = '// CampusLink: release APK is signed locally after download.';
const fresh = 'buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug; minifyEnabled true } }';

function temporary(t) {
  const tempRoot = resolve(tmpdir());
  const dir = mkdtempSync(join(tempRoot, 'campuslink-android-test-'));
  t.after(() => {
    assert.equal(dirname(resolve(dir)), tempRoot);
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
function fixture(t, gradle) {
  const dir = temporary(t);
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'android/app'), { recursive: true });
  const copied = join(dir, 'scripts/configure-android-release.mjs');
  copyFileSync(script, copied);
  const build = join(dir, 'android/app/build.gradle'), rules = join(dir, 'android/app/proguard-rules.pro');
  writeFileSync(build, gradle);
  writeFileSync(rules, '# Existing application rules\n-keep class example.Existing { *; }\n');
  return { run: () => spawnSync(process.execPath, [copied], { encoding: 'utf8' }),
    build: () => readFileSync(build, 'utf8'), rules: () => readFileSync(rules, 'utf8') };
}

test('release configuration retains debug signing and R8 while protecting the GL constructor and JNI callback', t => {
  const f = fixture(t, fresh);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.build(), /debug \{ signingConfig signingConfigs\.debug/);
  assert.match(f.build(), /minifyEnabled true/);
  assert.ok(f.build().includes(marker));
  assert.match(f.rules(), /example\.Existing/);
  assert.match(f.rules(), /-keepclassmembers class expo\.modules\.gl\.GLView \{\s+public <init>\(android\.content\.Context, expo\.modules\.kotlin\.AppContext\);/);
  assert.match(f.rules(), /-keepclassmembers class expo\.modules\.gl\.GLContext \{\s+public void flush\(\);/);
  const before = [f.build(), f.rules()];
  assert.equal(f.run().status, 0);
  assert.deepEqual([f.build(), f.rules()], before);
});

test('previously configured signing still receives the map crash fix', t => {
  const f = fixture(t, fresh.replace('release { signingConfig signingConfigs.debug;', `release {\n${marker}\n`));
  const before = f.build();
  assert.equal(f.run().status, 0);
  assert.equal(f.build(), before);
  assert.match(f.rules(), /public void flush\(\)/);
});

test('unsupported release signing templates fail without changing native configuration', t => {
  const f = fixture(t, 'buildTypes { release { customSigning() } }');
  const before = [f.build(), f.rules()];
  assert.notEqual(f.run().status, 0);
  assert.deepEqual([f.build(), f.rules()], before);
});

test('DEX verification accepts preserved obfuscated members and rejects native crash regressions', t => {
  const dir = temporary(t), mapping = join(dir, 'mapping.txt'), xml = join(dir, 'dex.xml');
  writeFileSync(mapping, 'expo.modules.gl.GLView -> a.A:\nexpo.modules.gl.GLContext -> a.B:\nexpo.modules.kotlin.AppContext -> b.C:\n');
  const valid = '<api><package name="a"><class name="A" extends="android.view.TextureView" abstract="false" interface="false">'
    + '<constructor visibility="public"><parameter type="android.content.Context"/><parameter type="b.C"/></constructor></class>'
    + '<class name="B" abstract="false" interface="false"><method name="flush" return="void" visibility="public" static="false" abstract="false"/></class></package></api>';
  const run = value => {
    writeFileSync(xml, value);
    return spawnSync(process.platform === 'win32' ? 'python' : 'python3', [verifier, mapping, xml], { encoding: 'utf8' });
  };
  const accepted = run(valid);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).GLView, 'a.A');
  for (const broken of [valid.replace('abstract="false"', 'abstract="true"'),
    valid.replace(/<constructor[\s\S]*?<\/constructor>/, ''), valid.replace('type="b.C"', 'type="java.lang.Object"'),
    valid.replace('name="flush"', 'name="a"'), valid.replace('return="void"', 'return="int"'),
    valid.replace('static="false"', 'static="true"'), valid.replace('name="A"', 'name="Elsewhere"')]) {
    const rejected = run(broken);
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /ValueError/);
  }
});
