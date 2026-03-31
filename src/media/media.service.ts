import { Inject, Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { GetSignedURLParams } from 'src/types/s3.types';
import { S3Config } from 'src/utils/constants/config.constants';
import { v4 as uuidV4 } from 'uuid';

@Injectable()
export class MediaService {
  private s3: S3;

  constructor(private readonly s3Config: S3Config) {
    this.s3 = new S3({
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      region: this.s3Config.region,
      signatureVersion: this.s3Config.signatureVersion,
    });
  }

  private _getMediaPath = (extension: string, path = '', fileName: string) => {
    const formattedPath = path ? `${path}/` : '';
    return `${formattedPath}${uuidV4()}_${fileName}.${extension}`;
  };

  private _getS3SignedURL = (params: GetSignedURLParams) => {
    const { operation, isPublic, Key, Expires } = params;

    if (operation === 'getObject' && isPublic)
      return `${process.env.S3_BASE_URL}/${Key}`;

    return this.s3.getSignedUrl(operation, {
      Bucket: this.s3Config.bucket,
      Key,
      Expires,
    });
  };

  async uploadFile(
    File: Buffer,
    fileName: string,
    path?: string,
    isPublic?: boolean,
  ) {
    const res = await this.getUploadPath(fileName, path, isPublic);

    await fetch(res?.url ?? '', {
      method: 'put',
      body: File,
    });

    return res?.path;
  }

  async getUploadPath(fileName: string, path?: string, isPublic?: boolean) {
    const name = fileName.split('.')[0];
    const extension = fileName.split('.').slice(-1)[0].toLowerCase();

    const Key = this._getMediaPath(extension, path, name);
    const url = this._getS3SignedURL({
      operation: 'putObject',
      Key,
      isPublic,
    });

    return { url, path: Key };
  }
}
