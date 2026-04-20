import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const MAX_DIMENSION = 512;

/**
 * Resize an image file client-side to fit within MAX_DIMENSION,
 * then upload to Firebase Storage. Returns the download URL.
 */
export async function uploadPlannerImage(file) {
  // Create an image element to read dimensions
  const img = await createImageBitmap(file);
  let { width, height } = img;

  // Scale down if needed
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }
  }

  // Draw to canvas and export as JPEG
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );

  // Upload to Firebase Storage
  const id = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const fileRef = storageRef(storage, `planner/images/${id}.png`);
  await uploadBytes(fileRef, blob);
  const url = await getDownloadURL(fileRef);

  return { url, width, height };
}
