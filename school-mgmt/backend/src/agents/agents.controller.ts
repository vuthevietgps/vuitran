import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  findAll(@Query() query: QueryAgentDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.OPS)
  create(@Body() dto: CreateAgentDto, @Request() req: any) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/suspend')
  @Roles(Role.DIRECTOR)
  suspend(@Param('id') id: string) {
    return this.service.suspend(id);
  }

  @Post(':id/activate')
  @Roles(Role.DIRECTOR)
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }
}
