import type { ImageLoaderProps } from "next/image";

const uploadPath = "/image/upload/";

export function isCloudinaryImageUrl(src: string) {
  return src.startsWith("https://res.cloudinary.com/") && src.includes(uploadPath);
}

export function cloudinaryImageUrl(src: string, width: number) {
  if (!isCloudinaryImageUrl(src)) return src;
  return src.replace(uploadPath, `${uploadPath}f_auto,q_auto,w_${width},c_limit/`);
}

export function cloudinaryImageLoader({ src, width }: ImageLoaderProps): string {
  return cloudinaryImageUrl(src, width);
}
