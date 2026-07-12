import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiFeedbackController } from './ai-feedback.controller';
import { AiFeedbackService } from './ai-feedback.service';
import { AiFeedback, AiFeedbackSchema } from './schemas/ai-feedback.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiFeedback.name, schema: AiFeedbackSchema },
    ]),
  ],
  controllers: [AiFeedbackController],
  providers: [AiFeedbackService],
  exports: [AiFeedbackService],
})
export class AiFeedbackModule {}
