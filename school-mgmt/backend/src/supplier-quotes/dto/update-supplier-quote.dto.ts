import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierQuoteDto } from './create-supplier-quote.dto';

export class UpdateSupplierQuoteDto extends PartialType(CreateSupplierQuoteDto) {}
