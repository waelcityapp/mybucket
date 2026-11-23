/** Compress using native browser APIs; never silently claim compression on unsupported devices. */
export async function compressAdVideo(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal, maxSeconds = 60): Promise<File> {
  signal?.throwIfAborted();
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('unsupported_video');
  const video = document.createElement('video');
  const sourceUrl = URL.createObjectURL(file);
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  let stream: MediaStream | null = null;
  let metadataTimer: number | undefined;
  let rejectPreparation: (reason: unknown) => void = () => {};
  const cancel = () => rejectPreparation(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      rejectPreparation = reject;
      metadataTimer = window.setTimeout(() => reject(new Error('invalid_video')), 10000);
      video.onloadedmetadata = () => { window.clearTimeout(metadataTimer); resolve(); };
      video.onerror = () => { window.clearTimeout(metadataTimer); reject(new Error('invalid_video')); };
    });
    signal?.throwIfAborted();
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('invalid_video_duration');
    if (video.duration > maxSeconds) throw new Error('video_too_long');
    if (file.size > 25 * 1024 * 1024) throw new Error('video_too_large');
    if (typeof MediaRecorder === 'undefined') throw new Error('video_compression_unavailable');
    const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream
      ?? (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
    if (!capture) throw new Error('video_compression_unavailable');
    const type = ['video/webm;codecs=vp8,opus','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error('video_compression_unavailable');
    stream = capture.call(video);
    if (!stream.getVideoTracks().length) throw new Error('video_compression_unavailable');
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    const result = new Promise<Blob>((resolve, reject) => {
      rejectPreparation = reject;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('video_compression_failed'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      video.onerror = () => { if (recorder.state !== 'inactive') recorder.stop(); reject(new Error('invalid_video')); };
    });
    const reportProgress = () => {
      const percent = Math.floor((video.currentTime / video.duration) * 100);
      onProgress?.(Math.min(99, percent));
    };
    video.ontimeupdate = reportProgress;
    reportProgress();
    recorder.start();
    const [, blob] = await Promise.all([video.play(), result]);
    if (!blob.size) throw new Error('video_compression_failed');
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webm', { type: 'video/webm', lastModified: file.lastModified });
  } finally {
    signal?.removeEventListener('abort', cancel);
    window.clearTimeout(metadataTimer);
    video.ontimeupdate = null;
    video.onloadedmetadata = null;
    video.onended = null;
    video.onerror = null;
    video.pause();
    stream?.getTracks().forEach(track => track.stop());
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(sourceUrl);
  }
}


export function validateAdVideoDuration(source: File | string, seconds: number): Promise<void> {
  const video = document.createElement('video');
  const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const finish = (error?: string) => {
      window.clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (error) reject(new Error(error));
      else resolve();
    };
    const timer = window.setTimeout(() => finish('invalid_video_duration'), 10000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(!Number.isFinite(video.duration) || video.duration <= 0
      ? 'invalid_video_duration' : video.duration > seconds ? 'video_too_long' : undefined);
    video.onerror = () => finish('invalid_video_duration');
    video.src = typeof source === 'string' ? source : objectUrl!;
  });
}
