import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

let isConfigured = false;

function configureCloudinary() {
  if (isConfigured) {
    return;
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary environment variables are not configured.");
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  isConfigured = true;
}

export type CloudinaryUploadResult = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
};

export async function uploadImage(
  buffer: Buffer,
  folder = "idai-stores/products",
): Promise<CloudinaryUploadResult> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", transformation: [{ quality: "auto" }] },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error("Cloudinary returned no upload result."));
          return;
        }
        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      },
    );

    Readable.from(buffer).pipe(upload);
  });
}
