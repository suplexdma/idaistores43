import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

let isConfigured = false;

function configureCloudinary() {
  if (isConfigured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
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

function upload(
  buffer: Buffer,
  folder: string,
  privateImage: boolean,
): Promise<CloudinaryUploadResult> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto" }],
        ...(privateImage ? { type: "authenticated", access_mode: "authenticated" } : {}),
      },
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
    Readable.from(buffer).pipe(uploadStream);
  });
}

export function uploadImage(buffer: Buffer, folder = "idai-stores/products") {
  return upload(buffer, folder, false);
}

export function uploadPrivateImage(buffer: Buffer, folder = "idai-stores/payment-screenshots") {
  return upload(buffer, folder, true);
}

export function getPrivateImageUrl(publicId: string) {
  configureCloudinary();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
  });
}

export async function deletePrivateImage(publicId: string) {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
  });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary could not delete the private payment screenshot.");
  }
}
