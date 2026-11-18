export type SignedAdUpload = {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  publicId: string;
  timestamp: number;
  signature: string;
  resourceType: 'image' | 'video';
  deliveryType: 'authenticated';
};
export type UploadedAdMedia = {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'video';
  version: number;
  bytes: number;
  format: string;
  responseSignature: string;
};

/** Returns untrusted provider response data; the server must verify it before storing or using it. */
export function uploadAdMedia(file: File | string, signed: SignedAdUpload, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<UploadedAdMedia> {
  if (!/^[a-zA-Z0-9_-]+$/.test(signed.cloudName) || !['image', 'video'].includes(signed.resourceType) || signed.deliveryType !== 'authenticated') return Promise.reject(new Error('invalid_upload_configuration'));
  if (signal?.aborted) return Promise.reject(new Error('upload_cancelled'));
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('upload_preset', signed.uploadPreset);
  form.append('public_id', signed.publicId);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('overwrite', 'false');
  form.append('type', signed.deliveryType);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let done = false;
    const finish = (error?: Error, result?: UploadedAdMedia) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(result!);
    };
    const cancel = () => { xhr.abort(); finish(new Error('upload_cancelled')); };
    signal?.addEventListener('abort', cancel, { once: true });
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.max(0, Math.round(event.loaded * 100 / event.total))));
    };
    xhr.onerror = () => finish(new Error('upload_network_error'));
    xhr.onabort = () => finish(new Error('upload_cancelled'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return finish(new Error('upload_failed'));
      try {
        const data = JSON.parse(xhr.responseText);
        const url = new URL(data.secure_url);
        if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || data.public_id !== signed.publicId ||
          data.resource_type !== signed.resourceType || !Number.isSafeInteger(data.version) || data.version <= 0 ||
          !Number.isSafeInteger(data.bytes) || data.bytes <= 0 || typeof data.format !== 'string' ||
          typeof data.signature !== 'string' || !/^[a-f0-9]{40}$/.test(data.signature)) throw new Error('invalid_response');
        finish(undefined, { secureUrl: url.href, publicId: data.public_id, resourceType: data.resource_type, version: data.version, bytes: data.bytes, format: data.format, responseSignature: data.signature });
      } catch { finish(new Error('invalid_upload_response')); }
    };
    xhr.send(form);
  });
}
