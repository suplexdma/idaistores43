export function optimizedImageUrl(url: string): string {
  const uploadPath = "/image/upload/";
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(uploadPath)) return url;
  return url.replace(uploadPath, `${uploadPath}f_auto,q_auto/`);
}
