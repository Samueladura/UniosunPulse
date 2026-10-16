import type {Asset} from 'react-native-image-picker';
import {apiFetch} from './api';

type CloudinaryResourceType = 'image' | 'video';

interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
}

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: {message?: string};
}

export function isVideoUrl(url: string): boolean {
  return /\/video\/upload\/|\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(url);
}

export async function uploadPostMedia(
  asset: Asset,
  target: 'posts' | 'marketplace' | 'elections' = 'posts',
): Promise<{image?: string; video?: string}> {
  if (!asset.uri) {
    throw new Error('The selected media file is unavailable.');
  }
  const resourceType: CloudinaryResourceType = asset.type?.startsWith('video/')
    ? 'video'
    : 'image';
  const signed = await apiFetch<{data: UploadSignature}>(
    '/media/upload-signature',
    {
      method: 'POST',
      body: JSON.stringify({resourceType, target}),
    },
  );
  const {cloudName, apiKey, timestamp, folder, publicId, signature} =
    signed.data;
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name:
      asset.fileName ||
      `post-${Date.now()}.${resourceType === 'video' ? 'mp4' : 'jpg'}`,
    type: asset.type || (resourceType === 'video' ? 'video/mp4' : 'image/jpeg'),
  });
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('public_id', publicId);
  form.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {method: 'POST', body: form},
  );
  const result = (await response.json()) as CloudinaryUploadResponse;
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Media upload failed.');
  }
  return resourceType === 'video'
    ? {video: result.secure_url}
    : {image: result.secure_url};
}
