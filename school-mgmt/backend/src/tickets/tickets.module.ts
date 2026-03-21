import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import {
  Ticket,
  TicketSchema,
  TicketComment,
  TicketCommentSchema,
} from './schemas/ticket.schema';
import { WalletsModule } from '../wallets/wallets.module';
import { ClassesModule } from '../classes/classes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: TicketComment.name, schema: TicketCommentSchema },
    ]),
    WalletsModule,
    forwardRef(() => ClassesModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
