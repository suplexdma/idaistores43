import type { ImageLoaderProps } from "next/image";

export function cloudinaryImageLoader({ src, width }: ImageLoaderProps): string {
  const uploadPath = "/image/upload/";
  if (!src.startsWith("https://res.cloudinary.com/") || !src.includes(uploadPath)) return src;
  return src.replace(uploadPath, `${uploadPath}f_auto,q_auto,w_${width},c_limit/`);
}
