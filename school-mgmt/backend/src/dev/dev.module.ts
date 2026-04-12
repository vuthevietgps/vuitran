import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DevCronController } from './dev-cron.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';

@Module({
  imports: [
    SessionsModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [DevCronController],
})
export class DevModule {}
