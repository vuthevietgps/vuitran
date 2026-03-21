import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeachingMaterialsController } from './teaching-materials.controller';
import { TeachingMaterialsService } from './teaching-materials.service';
import { TeachingMaterial, TeachingMaterialSchema } from './schemas/teaching-material.schema';
import {
  TeachingMaterialChunk,
  TeachingMaterialChunkSchema,
} from './schemas/teaching-material-chunk.schema';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeachingMaterial.name, schema: TeachingMaterialSchema },
      { name: TeachingMaterialChunk.name, schema: TeachingMaterialChunkSchema },
    ]),
    MessagesModule,
  ],
  controllers: [TeachingMaterialsController],
  providers: [TeachingMaterialsService],
  exports: [TeachingMaterialsService],
})
export class TeachingMaterialsModule {}
