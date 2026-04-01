import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agent, AgentDocument, AgentStatus } from './schemas/agent.schema';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {}

  private async generateAgentCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `AG-${rand}`;
      const exists = await this.agentModel.exists({ agentCode: code });
      if (!exists) return code;
    }
    return `AG-${Date.now()}`;
  }

  async create(dto: CreateAgentDto, user: any) {
    const agentCode = await this.generateAgentCode();
    return this.agentModel.create({
      ...dto,
      agentCode,
      createdById: new Types.ObjectId(user.sub),
      createdByName: user.fullName || user.email,
    });
  }

  async findAll(query: QueryAgentDto) {
    const filter: any = {};
    if (query.keyword) {
      const re = new RegExp(query.keyword, 'i');
      filter.$or = [
        { agentCode: re },
        { name: re },
        { contactPerson: re },
        { phone: re },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.tier) filter.tier = query.tier;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.agentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.agentModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.agentModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Agent not found');
    return doc;
  }

  async update(id: string, dto: UpdateAgentDto) {
    const doc = await this.agentModel.findById(id);
    if (!doc) throw new NotFoundException('Agent not found');
    Object.assign(doc, dto);
    return doc.save();
  }

  async remove(id: string) {
    const doc = await this.agentModel.findById(id);
    if (!doc) throw new NotFoundException('Agent not found');
    await doc.deleteOne();
    return { deleted: true };
  }

  async suspend(id: string) {
    const doc = await this.agentModel.findById(id);
    if (!doc) throw new NotFoundException('Agent not found');
    if (doc.status === AgentStatus.SUSPENDED) {
      throw new BadRequestException('Agent is already suspended');
    }
    doc.status = AgentStatus.SUSPENDED;
    return doc.save();
  }

  async activate(id: string) {
    const doc = await this.agentModel.findById(id);
    if (!doc) throw new NotFoundException('Agent not found');
    doc.status = AgentStatus.ACTIVE;
    return doc.save();
  }
}
