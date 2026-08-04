// Re-encodes a screenshot/photo down to a capped resolution and WebP
// quality before it ever reaches Supabase Storage, since attachment uploads
// are the fastest way to burn through the project's free-tier storage quota.
// WebP beats JPEG on flat-color UI screenshots (the common case here); if a
// browser can't encode WebP, canvas silently falls back to PNG, so that
// result is checked and JPEG is tried next. Non-image files pass through.
export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const { maxDimension = 1280, quality = 0.7 } = options;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / bitmap.width, maxDimension / bitmap.height);
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

    let blob = await encode("image/webp");
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await encode("image/jpeg");
      ext = "jpg";
    }
    if (!blob || blob.size >= file.size) return file;

    const compressedName = file.name.replace(/\.[^./\\]+$/, "") + "." + ext;
    return new File([blob], compressedName, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
