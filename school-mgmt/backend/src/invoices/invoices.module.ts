import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Express } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoicesApprovalService } from './invoices-approval.service';
import { InvoicesQueryService } from './invoices-query.service';
import { InvoicesOrderService } from './invoices-order.service';
import { InvoicesController } from './invoices.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WalletsModule } from '../wallets/wallets.module';
import { ClassesModule } from '../classes/classes.module';

const receiptUploadPath = join(process.cwd(), 'uploads', 'invoices');

if (!existsSync(receiptUploadPath)) {
  mkdirSync(receiptUploadPath, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = diskStorage({
  destination: receiptUploadPath,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Dinh dang file khong hop le'), '');
    }
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

const imageFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG)'), false);
  }
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MulterModule.register({ storage, fileFilter: imageFileFilter }),
    WalletsModule,
    ClassesModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesApprovalService, InvoicesQueryService, InvoicesOrderService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
