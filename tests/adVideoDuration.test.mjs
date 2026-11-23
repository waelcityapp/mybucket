import test from 'node:test';
import assert from 'node:assert/strict';
import {compressAdVideo} from '../src/utils/adVideoCompression.ts';

function mockVideo(duration) {
  const video={duration, muted:false, playsInline:false, pause(){}, load(){}, removeAttribute(){}};
  Object.defineProperty(video,'src',{set(){queueMicrotask(()=>video.onloadedmetadata?.());}});
  globalThis.document={createElement:()=>video};
  globalThis.window={setTimeout,clearTimeout};
  URL.createObjectURL=()=> 'blob:test';
  URL.revokeObjectURL=()=>{};
  delete globalThis.MediaRecorder;
}

test('rejects video over one minute before starting compression', async () => {
  mockVideo(60.01);
  await assert.rejects(compressAdVideo({type:'video/mp4',size:100}),/video_too_long/);
});

test('allows the exact one-minute boundary through the duration check', async () => {
  mockVideo(60);
  await assert.rejects(compressAdVideo({type:'video/mp4',size:100}),/video_compression_unavailable/);
});

test('rejects unreadable duration before compression', async () => {
  mockVideo(NaN);
  await assert.rejects(compressAdVideo({type:'video/mp4',size:100}),/invalid_video_duration/);
});

test('rejects Featured over 30 seconds and accepts its exact boundary before compression', async () => {
  mockVideo(30.01);
  await assert.rejects(compressAdVideo({type:'video/mp4',size:100}, undefined, undefined, 30), /video_too_long/);
  mockVideo(30);
  await assert.rejects(compressAdVideo({type:'video/mp4',size:100}, undefined, undefined, 30), /video_compression_unavailable/);
});
