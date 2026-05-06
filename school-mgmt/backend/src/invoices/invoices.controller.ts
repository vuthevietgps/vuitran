import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { QueryInvoiceManagementDto } from './dto/query-invoice-management.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  create(@Body() createInvoiceDto: CreateInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.create(createInvoiceDto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.findAll(req.user);
  }

  @Get('management')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  findManagement(
    @Query() query: QueryInvoiceManagementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.findManagement(query, req.user);
  }

  /** PH xem hóa đơn của tất cả con */
  @Get('my-children')
  @Roles(Role.PARENT)
  getParentInvoices(@Req() req: AuthenticatedRequest) {
    return this.invoicesService.getParentInvoices(req.user.sub);
  }

  /** Danh sách hóa đơn chờ duyệt (DIRECTOR / ACCOUNTING) */
  @Get('pending')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  findPendingApproval() {
    return this.invoicesService.findPendingApproval();
  }

  @Get('student/:studentId')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  getInvoicesByStudent(
    @Param('studentId', ParseMongoIdPipe) studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.getInvoicesByStudent(studentId, req.user);
  }

  @Get('payments/all')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  getAllPaymentInvoices() {
    return this.invoicesService.getAllPaymentInvoices();
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE, Role.PARENT)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.findOne(id, req.user);
  }

  @Post('payments/:studentId/:frameIndex/confirm')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  confirmPayment(
    @Param('studentId', ParseMongoIdPipe) studentId: string,
    @Param('frameIndex') frameIndex: string,
    @Body() body: { action: 'CONFIRM' | 'REJECT' }
  ) {
    return this.invoicesService.confirmPayment(studentId, parseInt(frameIndex), body.action);
  }

  /** Duyệt hoặc từ chối hóa đơn (DIRECTOR / ACCOUNTING) */
  @Post(':id/approve')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  approveInvoice(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ApproveInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.approveInvoice(id, dto, req.user);
  }

  /** Hủy hóa đơn APPROVED và rollback wallet — BUG NGHIÊM TRỌNG fix */
  @Post(':id/cancel')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  cancelInvoice(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invoicesService.cancelInvoice(id, req.user, reason);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.SALE, Role.ACCOUNTING)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateInvoiceDto: UpdateInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.invoicesService.update(id, updateInvoiceDto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.invoicesService.remove(id);
  }

  @Post('receipt-upload')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.SALE)
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận file ảnh (JPG, PNG)');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new BadRequestException('File không được vượt quá 5MB');
    }

    // Return relative path for frontend
    const relativePath = `/uploads/invoices/${file.filename}`;
    return { url: relativePath };
  }
}
