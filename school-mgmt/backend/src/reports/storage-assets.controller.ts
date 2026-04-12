import { Controller, ForbiddenException, Get, Header, NotFoundException, Query, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { basename } from 'path';
import { StorageUrlService } from '../common/storage-url.service';

@Controller('secure-assets')
export class StorageAssetsController {
  constructor(private readonly storageUrlService: StorageUrlService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async getAsset(
    @Query('key') key?: string,
    @Query('exp') exp?: string,
    @Query('sig') sig?: string,
  ) {
    const { assetKey } = this.storageUrlService.verifySignedAssetRequest({ key, exp, sig });
    const absolutePath = this.storageUrlService.resolveLocalAssetPath(assetKey);

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File khong ton tai');
    }

    return new StreamableFile(createReadStream(absolutePath), {
      type: this.storageUrlService.getContentType(absolutePath),
      disposition: `inline; filename="${basename(absolutePath)}"`,
    });
  }
}
