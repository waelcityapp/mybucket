/** Compress using native browser APIs; never silently claim compression on unsupported devices. */
export async function compressAdVideo(file: File): Promise<File> {
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('unsupported_video');
  const video = document.createElement('video');
  const sourceUrl = URL.createObjectURL(file);
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  let stream: MediaStream | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('invalid_video')), 10000);
      video.onloadedmetadata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error('invalid_video')); };
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('invalid_video_duration');
    if (video.duration > 60) throw new Error('video_too_long');
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
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('video_compression_failed'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      video.onerror = () => { if (recorder.state !== 'inactive') recorder.stop(); reject(new Error('invalid_video')); };
    });
    recorder.start();
    await video.play();
    const blob = await result;
    if (!blob.size) throw new Error('video_compression_failed');
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webm', { type: 'video/webm', lastModified: file.lastModified });
  } finally {
    video.pause();
    stream?.getTracks().forEach(track => track.stop());
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(sourceUrl);
  }
}
