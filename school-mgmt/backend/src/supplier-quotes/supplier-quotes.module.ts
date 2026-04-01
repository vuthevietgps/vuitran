import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplierQuote, SupplierQuoteSchema } from './schemas/supplier-quote.schema';
import { SupplierQuotesController } from './supplier-quotes.controller';
import { SupplierQuotesService } from './supplier-quotes.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupplierQuote.name, schema: SupplierQuoteSchema },
    ]),
  ],
  controllers: [SupplierQuotesController],
  providers: [SupplierQuotesService],
  exports: [SupplierQuotesService],
})
export class SupplierQuotesModule {}
