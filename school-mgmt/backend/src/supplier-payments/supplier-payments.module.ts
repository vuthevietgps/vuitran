import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplierPayment, SupplierPaymentSchema } from './schemas/supplier-payment.schema';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { SupplierPaymentsService } from './supplier-payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupplierPayment.name, schema: SupplierPaymentSchema },
    ]),
  ],
  controllers: [SupplierPaymentsController],
  providers: [SupplierPaymentsService],
  exports: [SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
