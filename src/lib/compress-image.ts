// Re-encodes a screenshot/photo down to a capped resolution and JPEG
// quality before it ever reaches Supabase Storage, since attachment uploads
// are the fastest way to burn through the project's free-tier storage quota.
// JPEG (not WebP) on purpose: these compressed files are also sent straight
// to Groq's vision model for AI analysis, and WebP silently made that model
// return empty/unusable results — JPEG is universally supported. Non-image
// files pass through unchanged.
export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const { maxDimension = 1280, quality = 0.72 } = options;

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

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const compressedName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], compressedName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
