import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import 'multer';

@Injectable()
export class CloudinaryService {

  async uploadFile(
  file: Express.Multer.File,
  folder: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {

    const isVideo = file.mimetype.startsWith('video');
    const resourceType = isVideo ? 'video' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary upload failed'));
        resolve(result);
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
 }
}