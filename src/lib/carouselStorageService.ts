/**
 * Carousel Storage Service
 * 
 * Manages WebP uploads, replacements, deletions, and binary validations
 * for the MshindiRoom Weekly Editorial homepage carousel using Firebase Storage.
 * 
 * Dedicated Storage Path Pattern:
 *   homepage-carousel/{photoId}/{timestamp}-{cleanFileName}.webp
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from 'firebase/storage';
import { storage, auth } from '../firebase';
import { isAdminPhone } from './authStore';

export const MAX_WEBP_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface WebpValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  mimeType?: string;
  name?: string;
}

export interface UploadProgressCallback {
  (progressPercent: number, snapshot?: UploadTaskSnapshot): void;
}

export interface UploadResult {
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
}

/**
 * Formats byte size into human-readable text (e.g. 1.25 MB, 480 KB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validates whether the given binary buffer starts with the RIFF container
 * header and the WEBP fourCC signature (RFC 6386).
 *
 * Header structure:
 *   Bytes 0..3:  0x52 0x49 0x46 0x46 ('RIFF')
 *   Bytes 4..7:  File size
 *   Bytes 8..11: 0x57 0x45 0x42 0x50 ('WEBP')
 */
export function verifyWebpMagicBytes(headerBytes: Uint8Array): boolean {
  if (!headerBytes || headerBytes.length < 12) return false;
  const isRiff =
    headerBytes[0] === 0x52 && // 'R'
    headerBytes[1] === 0x49 && // 'I'
    headerBytes[2] === 0x46 && // 'F'
    headerBytes[3] === 0x46;   // 'F'

  const isWebp =
    headerBytes[8] === 0x57 &&  // 'W'
    headerBytes[9] === 0x45 &&  // 'E'
    headerBytes[10] === 0x42 && // 'B'
    headerBytes[11] === 0x50;  // 'P'

  return isRiff && isWebp;
}

/**
 * Rigorously validates a selected file on the client:
 * 1. Rejects null or empty files.
 * 2. Enforces maximum file size limit (5 MB).
 * 3. Enforces .webp extension and image/webp MIME type.
 * 4. Inspects binary magic bytes (RIFF/WEBP) to prevent masquerading.
 * 5. Decodes the image in the browser to extract dimensions and verify decodability.
 */
export async function validateWebpFile(file: File): Promise<WebpValidationResult> {
  if (!file) {
    return { valid: false, error: 'No file selected. Please choose a WebP image.' };
  }

  // 1. Check size limit
  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty (0 bytes).' };
  }
  if (file.size > MAX_WEBP_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of ${formatFileSize(MAX_WEBP_FILE_SIZE_BYTES)}.`,
    };
  }

  // 2. Check extension and reported MIME type
  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith('.webp')) {
    return {
      valid: false,
      error: 'Only WebP (.webp) images are permitted. Please convert or select a valid .webp photo.',
    };
  }

  if (file.type && file.type !== 'image/webp') {
    return {
      valid: false,
      error: `Invalid MIME type (${file.type}). Only image/webp is accepted.`,
    };
  }

  // 3. Binary header inspection (Magic Bytes: RIFF + WEBP)
  try {
    const slice = file.slice(0, 16);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const hasValidHeader = verifyWebpMagicBytes(bytes);

    if (!hasValidHeader) {
      return {
        valid: false,
        error: 'The file header does not match a valid WebP RIFF container. The file may be corrupt or improperly converted.',
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Could not verify file binary header: ${err?.message || 'Read error'}`,
    };
  }

  // 4. Decode the image in the browser to verify visual integrity and extract dimensions
  if (typeof window !== 'undefined') {
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            reject(new Error('Image has zero dimensions.'));
          } else {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to decode WebP image. The image data may be corrupted.'));
        };

        img.src = objectUrl;
      });

      return {
        valid: true,
        width: dimensions.width,
        height: dimensions.height,
        sizeBytes: file.size,
        mimeType: 'image/webp',
        name: fileName,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err?.message || 'Failed to decode WebP image.',
      };
    }
  }

  return {
    valid: true,
    sizeBytes: file.size,
    mimeType: 'image/webp',
    name: fileName,
  };
}

/**
 * Builds a clean, unique, predictable Firebase Storage path for carousel photos:
 *   homepage-carousel/{photoId}/{timestamp}-{cleanFileName}.webp
 */
export function buildCarouselStoragePath(photoId: string, originalFileName: string): string {
  const cleanId = photoId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseName = originalFileName.replace(/\.[^/.]+$/, '');
  const cleanName = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'slide';
  const timestamp = Date.now();
  return `homepage-carousel/${cleanId}/${timestamp}-${cleanName}.webp`;
}

/**
 * Uploads a validated WebP image binary directly to Firebase Storage with progress tracking.
 * Falls back to server upload only if Firebase Storage is uninitialized in local environment.
 */
export async function uploadCarouselPhotoWebp(
  file: File,
  photoId: string,
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  // Pre-validate file
  const validation = await validateWebpFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid WebP file.');
  }

  const storagePath = buildCarouselStoragePath(photoId, file.name);
  const dimensions = {
    width: validation.width || 800,
    height: validation.height || 1067,
  };

  // 1. Primary: Upload directly to Firebase Storage bucket
  if (storage) {
    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: 'image/webp',
        customMetadata: {
          photoId,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          width: String(dimensions.width),
          height: String(dimensions.height),
        },
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.min(Math.round(progress), 99), snapshot);
            }
          },
          (error) => {
            reject(error);
          },
          () => {
            if (onProgress) {
              onProgress(100);
            }
            resolve();
          }
        );
      });

      const downloadUrl = await getDownloadURL(storageRef);

      return {
        storagePath,
        downloadUrl,
        fileName: file.name,
        fileSize: file.size,
        dimensions,
      };
    } catch (storageErr: any) {
      console.warn('[CarouselStorage] Firebase Storage direct upload failed, trying server endpoint:', storageErr);
      // Fall through to server upload if Firebase Storage upload fails (e.g. offline emulator)
    }
  }

  // 2. Fallback: Upload via server endpoint for reliable local persistence
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/admin/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl: base64Data,
        fileName: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        folder: 'homepage-carousel',
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.url) {
      throw new Error(data.error || 'Server upload failed');
    }

    if (onProgress) onProgress(100);

    return {
      storagePath,
      downloadUrl: data.url,
      fileName: file.name,
      fileSize: file.size,
      dimensions,
    };
  } catch (serverErr: any) {
    throw new Error(`Failed to upload WebP photo: ${serverErr?.message || 'Storage error'}`);
  }
}

/**
 * Safely deletes a carousel photo object from Firebase Storage.
 * Gracefully ignores "object-not-found" errors so database deletion is never blocked.
 */
export async function deleteCarouselPhotoStorage(storagePath: string | undefined): Promise<boolean> {
  if (!storagePath || !storagePath.startsWith('homepage-carousel/')) {
    return false; // Nothing to delete or legacy external URL
  }

  if (!storage) return false;

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err: any) {
    // If the object was already deleted or doesn't exist, ignore gracefully
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn('[CarouselStorage] Could not delete Storage object:', storagePath, err?.message);
    return false;
  }
}

/**
 * Safe Photo Replacement Workflow:
 * 1. Uploads new WebP file to a distinct Storage path.
 * 2. Waits for new upload to succeed.
 * 3. Deletes the old Storage object only after confirmed replacement.
 * 4. Preserves old image intact if the new upload fails.
 */
export async function replaceCarouselPhotoWebp(
  oldStoragePath: string | undefined,
  newFile: File,
  photoId: string,
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  // 1. Upload new image first
  const newUploadResult = await uploadCarouselPhotoWebp(newFile, photoId, onProgress);

  // 2. If new upload succeeded and an old storage path exists, clean up the old file
  if (oldStoragePath && oldStoragePath !== newUploadResult.storagePath) {
    deleteCarouselPhotoStorage(oldStoragePath).catch((err) => {
      console.warn('[CarouselStorage] Deferred cleanup warning for old photo:', oldStoragePath, err);
    });
  }

  return newUploadResult;
}
