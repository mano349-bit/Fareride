// Keep both ride display images below Firestore's 1 MiB document limit.
export async function prepareDriverPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image');
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 350000) return data;
    }
    throw new Error('Image too large');
  } catch {
    throw new Error('Unable to prepare a photo. Take a new JPG or PNG photo and retry.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canShowDriverPhotos(ride, uid) {
  return Boolean(uid && ride?.riderId === uid && ride.driverId && ['accepted', 'arrived', 'started'].includes(ride.status));
}
export function validDriverPhoto(value) {
  return typeof value === 'string' && value.length <= 350000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
}
