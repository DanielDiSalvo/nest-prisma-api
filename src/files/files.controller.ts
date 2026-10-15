import type {} from 'multer';

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { ApiBody, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';

import { FilesService } from './files.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png)$/,
          }),
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.uploadFile(file);
  }

  @Get('url/*path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getFileUrl(@Param('path') path: string[]) {
    const key = path.join('/');
    return this.filesService.getFileUrl(key);
  }

  @Delete('url/*path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deleteFile(@Param('path') path: string[]) {
    const key = path.join('/');
    return this.filesService.deleteFile(key);
  }
}
