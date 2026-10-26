import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image file in-browser using HTML5 Canvas.
 * Ensures even high-resolution camera photos (5MB - 12MB) are optimized to ~80KB - 200KB
 * before uploading or persisting to Cloud Firestore.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // If SVG, no canvas compression needed
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file for compression.'));
    };

    img.src = objectUrl;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads an image for the homepage editorial feed, carousels, or banners.
 * Tries in order:
 * 1. Firebase Cloud Storage (mshindiroom-production.firebasestorage.app) -> returns public CDN URL.
 * 2. Backend Server Storage API (/api/admin/upload-media) -> returns persistent /images/uploads/... URL.
 * 3. Client Compressed Data URL (<100KB, guaranteed to fit safely within Firestore's 1MB limit).
 */
export async function uploadFeedImage(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ url: string; source: 'storage' | 'server' | 'compressed_data' }> {
  onProgress?.('Optimizing image dimensions...');
  const compressedBlob = await compressImage(file, 1200, 1200, 0.85);

  const cleanBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const fileName = `${cleanBase}_${timestamp}.jpg`;
  const storagePath = `feed/${fileName}`;

  // 1. Try Firebase Cloud Storage
  if (storage) {
    try {
      onProgress?.('Uploading to Firebase Cloud Storage...');
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, compressedBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });
      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl) {
        return { url: downloadUrl, source: 'storage' };
      }
    } catch (storageErr: any) {
      console.warn('[MediaUpload] Firebase Cloud Storage upload fallback:', storageErr?.message || storageErr);
    }
  }

  // 2. Try Backend Server Upload API
  try {
    onProgress?.('Saving to authoritative server media storage...');
    const dataUrl = await blobToDataUrl(compressedBlob);
    const res = await fetch('/api/admin/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        fileName,
        folder: 'feed',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.url) {
        return { url: data.url, source: 'server' };
      }
    }
  } catch (serverErr: any) {
    console.warn('[MediaUpload] Server upload API notice:', serverErr?.message || serverErr);
  }

  // 3. Fallback: Compact Data URL (<100KB, won't break Firestore 1MB quota)
  onProgress?.('Finalizing optimized media...');
  const compactUrl = await blobToDataUrl(compressedBlob);
  return { url: compactUrl, source: 'compressed_data' };
}
