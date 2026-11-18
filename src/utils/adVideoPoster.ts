/** Capture an early frame locally without playing or uploading the video. */
export function captureAdVideoPoster(src: string, onPoster: (poster: string) => void): () => void {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  let disposed = false;
  const timeout = window.setTimeout(cleanup, 8000);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timeout);
    video.onloadedmetadata = null;
    video.onloadeddata = null;
    video.onseeked = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
  }

  function capture() {
    if (!video.videoWidth || !video.videoHeight) {
      cleanup();
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        onPoster(canvas.toDataURL('image/jpeg', 0.82));
      }
    } catch {
      // The player remains available if the browser cannot export the frame.
    } finally {
      cleanup();
    }
  }

  video.onerror = cleanup;
  video.onloadedmetadata = () => {
    const position = Number.isFinite(video.duration) ? Math.min(5, video.duration * 0.15) : 0;
    if (position > 0) {
      video.onseeked = capture;
      try {
        video.currentTime = position;
      } catch {
        cleanup();
      }
    } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      capture();
    } else {
      video.onloadeddata = capture;
    }
  };
  video.src = src;
  return cleanup;
}
