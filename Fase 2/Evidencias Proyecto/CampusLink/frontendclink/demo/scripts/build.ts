import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/** Local H.264 encoder; decoding must succeed before reporting delivery. */
export async function buildVideo() {
  const require = createRequire(resolve('package.json'));
  const ffmpeg: string = process.env.FFMPEG_PATH || require('ffmpeg-static');
  const artifacts = resolve('demo/.artifacts');
  const output = resolve('../docs/demo');
  const recording = JSON.parse(await readFile(resolve(artifacts, 'recording.json'), 'utf8'));
  await mkdir(output, { recursive: true });
  const target = resolve(output, 'campuslink-demo.mp4');
  const encoded = resolve(artifacts, 'campuslink-demo.mp4');
  function run(args: string[]) {
    const result = spawnSync(ffmpeg, ['-hide_banner', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.error) throw new Error(`FFmpeg unavailable. Set FFMPEG_PATH or run node node_modules/ffmpeg-static/install.js. ${result.error.message}`);
    if (result.status !== 0) throw new Error('FFmpeg failed: ' + result.stderr.slice(-4000));
    return result.stderr;
  }
  run(['-y', '-ss', String(recording.leadInSeconds), '-i', recording.rawVideo, '-t', String(recording.durationSeconds),
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.4',
    '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', encoded]);
  const probe = run(['-i', encoded, '-f', 'null', '-']);
  if (!probe.includes('h264') || !probe.includes('yuv420p') || !probe.includes('1280x720')) throw new Error('Unexpected output encoding');
  const duration = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(probe);
  if (!duration) throw new Error('Could not verify duration');
  const durationSeconds = +duration[1] * 3600 + +duration[2] * 60 + +duration[3];
  const sizeBytes = (await stat(encoded)).size;
  if (durationSeconds < 60 || durationSeconds > 120) throw new Error(`Demo duration outside 60–120 seconds: ${durationSeconds}`);
  if (sizeBytes > 20 * 1024 * 1024) throw new Error('MP4 exceeds 20 MiB; adjust CRF before publishing');
  await copyFile(encoded, target);
  await copyFile(resolve(artifacts, 'thumbnail.png'), resolve(output, 'thumbnail.png'));
  const metadata = { mode: recording.mode, modules: recording.modules, timeline: recording.timeline,
    durationSeconds, width: 1280, height: 720, fps: 30, codec: 'h264', pixelFormat: 'yuv420p', sizeBytes,
    fullDecodeVerified: true, audio: false };
  await writeFile(resolve(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log(`MP4 verified: ${durationSeconds}s, 1280x720, ${(sizeBytes / 1024 / 1024).toFixed(2)} MiB`);
}

if (require.main === module) buildVideo().catch(error => { console.error(error); process.exitCode = 1; });
