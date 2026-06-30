import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

// Design-doc screenshots should keep their actual fidelity. We only downscale
// if the image is absurdly large (>= MAX_DIMENSION on the long side) — and
// even then we only downscale enough to fit. For anything smaller we upload
// the raw bytes, which preserves PNG transparency, avoids JPEG re-encoding
// artifacts, and is faster.
const MAX_DIMENSION = 2400;
// Skip re-encoding for files under this size in bytes; otherwise even tiny
// images get a canvas re-encode round-trip which is wasted work.
const RAW_UPLOAD_BYTES_THRESHOLD = 6 * 1024 * 1024; // 6 MB

/**
 * Upload a doc image to Firebase Storage. Returns { url, width, height }.
 * If the image is reasonably sized, uploads the raw file untouched. Only
 * downscales when it would exceed MAX_DIMENSION on the long edge.
 */
export async function uploadDocImage(file) {
  const ext = pickExtension(file);

  // Cheap path: small enough and not absurd, upload as-is.
  if (file.size <= RAW_UPLOAD_BYTES_THRESHOLD) {
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        const url = await uploadBlob(file, ext);
        return { url, width, height };
      }
      // Fall through to resize path below — bitmap is reused.
      return await resizeAndUpload(bitmap, ext);
    } catch (e) {
      // Some clipboard image types may not be decodable with createImageBitmap
      // (rare). Fall back to uploading the raw file untouched.
      const url = await uploadBlob(file, ext);
      return { url };
    }
  }

  // Big-file path: decode, resize, upload.
  const bitmap = await createImageBitmap(file);
  return await resizeAndUpload(bitmap, ext);
}

/**
 * Resize a decoded ImageBitmap to fit within MAX_DIMENSION on its longest
 * side and upload the result. Preserves aspect ratio. Output format follows
 * the original file's extension when possible (PNG → PNG, otherwise JPEG).
 */
async function resizeAndUpload(bitmap, ext) {
  let { width, height } = bitmap;
  if (width >= height) {
    height = Math.round((height / width) * MAX_DIMENSION);
    width = MAX_DIMENSION;
  } else {
    width = Math.round((width / height) * MAX_DIMENSION);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // High-quality bilinear-ish scaling — the default but explicit so we know.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  const outMime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const outExt = ext === 'png' ? 'png' : 'jpg';
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, outMime, outMime === 'image/jpeg' ? 0.92 : undefined)
  );
  const url = await uploadBlob(blob, outExt);
  return { url, width, height };
}

async function uploadBlob(blob, ext) {
  const id = 'doc-img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const fileRef = storageRef(storage, `docs/images/${id}.${ext}`);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}

function pickExtension(file) {
  const t = (file.type || '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  // Fallback by filename
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  if (name.endsWith('.gif')) return 'gif';
  return 'jpg';
}
