/** Shrink an image file to a square-ish JPEG data URL (max side px) for portraits. Keeps IndexedDB small. */
export async function toPortrait(file: File, max = 320): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    // Centre-crop to a square, then scale down.
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 4 // bias towards the top: faces
    const out = Math.min(max, side)
    const canvas = document.createElement('canvas')
    canvas.width = out; canvas.height = out
    canvas.getContext('2d')!.drawImage(img, sx, Math.max(0, sy), side, side, 0, 0, out, out)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

/** Downscale a large photo for notes (max side px). Small images and GIFs are kept as they are. */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size < 400_000) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < 1_500_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return await new Promise<Blob>(res => canvas.toBlob(b => res(b ?? file), type, 0.85))
  } catch { return file } finally { URL.revokeObjectURL(url) }
}
