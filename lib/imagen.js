// Reduce una imagen a máx 1280px y la comprime a JPEG (subidas livianas en móvil).
export async function comprimirImagen(file) {
  if (!file.type?.startsWith('image/')) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const MAX = 1280;
    let { width, height } = img;
    if (width > MAX || height > MAX) {
      const r = Math.min(MAX / width, MAX / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    return blob || file;
  } catch {
    return file;
  }
}
