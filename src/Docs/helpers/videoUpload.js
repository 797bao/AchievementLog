import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

/**
 * Upload a doc video to Firebase Storage. Returns { url }.
 *
 * Unlike images, we don't re-encode — videos take serious CPU to transcode
 * client-side and the result would lose quality. We just stream the file as-is.
 * A soft 50 MB cap warns about quota; the user can override.
 */
const SOFT_CAP_BYTES = 50 * 1024 * 1024;

export async function uploadDocVideo(file) {
  if (file.size > SOFT_CAP_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    const ok = window.confirm(
      `This video is ${mb} MB, larger than the 50 MB recommended cap.\n\n` +
      `Compressing first (OBS at lower bitrate, or run through HandBrake) ` +
      `will save Firebase Storage quota.\n\n` +
      `Upload anyway?`
    );
    if (!ok) throw new Error('Upload cancelled');
  }
  const ext = pickExtension(file);
  const id = 'doc-vid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const fileRef = storageRef(storage, `docs/videos/${id}.${ext}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url };
}

function pickExtension(file) {
  const t = (file.type || '').toLowerCase();
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime') || t.includes('mov')) return 'mov';
  if (t.includes('ogg')) return 'ogv';
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.mp4')) return 'mp4';
  if (name.endsWith('.webm')) return 'webm';
  if (name.endsWith('.mov')) return 'mov';
  if (name.endsWith('.ogv') || name.endsWith('.ogg')) return 'ogv';
  return 'mp4';
}
