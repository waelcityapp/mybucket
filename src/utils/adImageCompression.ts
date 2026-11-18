/** Compress locally without making the result larger or losing PNG transparency. */
export async function compressAdImage(file: File, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('unsupported_image');
  const url = URL.createObjectURL(file);
  const img = new Image();
  let rejectLoading: (reason: unknown) => void = () => {};
  const cancel = () => rejectLoading(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      rejectLoading = reject;
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('invalid_image'));
      img.src = url;
    });
    signal?.throwIfAborted();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('compression_unavailable');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, 0.82));
    signal?.throwIfAborted();
    if (!blob || blob.type !== file.type || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } finally {
    signal?.removeEventListener('abort', cancel);
    img.onload = null;
    img.onerror = null;
    img.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}
