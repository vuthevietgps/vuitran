import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { ApproveOrderDto, RejectOrderDto, RequestInfoDto } from './dto/order-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { OrderWorkflowService } from './order-workflow.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  @Post()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
    return this.ordersService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  findAll(@Query() query: QueryOrderDto, @Req() req: AuthenticatedRequest) {
    return this.ordersService.findAll(query, req.user);
  }

  @Get('pipeline')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  getPipeline(@Req() req: AuthenticatedRequest) {
    return this.ordersService.getPipeline(req.user);
  }

  @Get('stats')
  @Roles(Role.DIRECTOR)
  getStats(@Req() req: AuthenticatedRequest) {
    return this.ordersService.getStats(req.user);
  }

  @Get('commission-report')
  @Roles(Role.DIRECTOR, Role.SALE, Role.ACCOUNTING)
  getCommissionReport(
    @Req() req: AuthenticatedRequest,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const saleId = req.user.role === Role.SALE ? req.user.sub : undefined;
    return this.ordersService.getCommissionReport(saleId, fromDate, toDate);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.SALE, Role.OPS)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateOrderDto, @Req() req: AuthenticatedRequest) {
    return this.ordersService.update(id, dto, req.user);
  }

  @Post(':id/submit')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  submit(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.submit(id, req.user);
  }

  @Post(':id/approve')
  @Roles(Role.OPS, Role.DIRECTOR)
  approve(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: ApproveOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orderWorkflowService.approve(id, req.user, body.approvalImage);
  }

  @Post(':id/reject')
  @Roles(Role.OPS, Role.DIRECTOR)
  reject(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: RejectOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.reject(id, body.reason, req.user);
  }

  @Post(':id/request-info')
  @Roles(Role.OPS, Role.DIRECTOR)
  requestInfo(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: RequestInfoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.requestInfo(id, body.reason, req.user);
  }

  @Post(':id/cancel')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  cancel(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.orderWorkflowService.cancel(id, req.user);
  }

  @Post(':id/resubmit')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  resubmit(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.resubmit(id, req.user);
  }

  @Post(':id/complete')
  @Roles(Role.OPS, Role.DIRECTOR)
  complete(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.complete(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ordersService.remove(id, req.user);
  }
}
