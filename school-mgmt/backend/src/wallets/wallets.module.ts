import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Express } from 'express';
import { WalletsService } from './wallets.service';
import { WalletsTopUpService } from './wallets-topup.service';
import { WalletsOperationsService } from './wallets-operations.service';
import { WalletsQueryService } from './wallets-query.service';
import { WalletsController } from './wallets.controller';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { LedgerEntry, LedgerEntrySchema } from './schemas/ledger-entry.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { BankAccount, BankAccountSchema } from '../financial-control/schemas/bank-account.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { ParentAttribution, ParentAttributionSchema } from '../marketing-attribution/schemas/parent-attribution.schema';

const walletReceiptPath = join(process.cwd(), 'uploads', 'wallets');
if (!existsSync(walletReceiptPath)) mkdirSync(walletReceiptPath, { recursive: true });

const walletReceiptStorage = diskStorage({
  destination: walletReceiptPath,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `wallet-receipt-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const walletImageFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG)'), false);
  }
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: BankAccount.name, schema: BankAccountSchema },
      { name: Student.name, schema: StudentSchema },
      { name: ParentAttribution.name, schema: ParentAttributionSchema },
    ]),
    MulterModule.register({
      storage: walletReceiptStorage,
      fileFilter: walletImageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [WalletsController],
  providers: [WalletsService, WalletsTopUpService, WalletsOperationsService, WalletsQueryService],
  exports: [WalletsService],
})
export class WalletsModule {}
