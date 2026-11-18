import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  private readonly s3: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        )!,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, userId: number) {
    const extension = extname(file.originalname);
    const key = `uploads/${randomUUID()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3.send(command);

    try {
      const savedFile = await this.prisma.file.create({
        data: {
          key,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          userId,
        },
      });

      return savedFile;
    } catch (error) {
      try {
        await this.deleteFromS3(key);
      } catch (cleanupError) {
        console.error('Failed to clean up S3 file:', key, cleanupError);
      }

      throw error;
    }
  }

  async getFile(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: key,
    });

    return this.s3.send(command);
  }

  private async findOwnedFile(key: string, userId: number) {
    const file = await this.prisma.file.findFirst({
      where: {
        key,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getFileUrl(key: string, userId: number) {
    await this.findOwnedFile(key, userId);

    const command = new GetObjectCommand({
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: 60,
    });

    return { url };
  }

  private async deleteFromS3(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: key,
    });

    await this.s3.send(command);
  }

  async deleteFile(key: string, userId: number) {
    const file = await this.findOwnedFile(key, userId);

    await this.deleteFromS3(key);

    await this.prisma.file.delete({
      where: {
        id: file.id,
      },
    });

    return {
      message: 'File deleted successfully',
      key,
    };
  }
}
