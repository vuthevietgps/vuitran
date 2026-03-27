import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { OrderCommunicationSummary } from './schemas/order.schema';

export interface ParentAccountSummary {
  parentUserId: string;
  fullName: string;
  email: string;
  phone: string;
  source: 'LINKED_ORDER' | 'MATCHED_EMAIL' | 'MATCHED_PHONE' | 'AUTO_CREATED';
  wasAutoCreated: boolean;
}

export interface InvoiceReference {
  invoiceId: string;
  invoiceNumber: string;
}

type TeacherRecipient = {
  _id: Types.ObjectId;
  fullName?: string;
};

@Injectable()
export class OrderCommunicationService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private compactLines(lines: Array<string | undefined | null | false>): string {
    return lines.filter((line): line is string => !!line && !!line.trim()).join('\n');
  }

  private formatTeachingMode(value?: string): string {
    if (value === 'OFFLINE') return 'Offline';
    return 'Online';
  }

  private parentSourceLabel(source: ParentAccountSummary['source']): string {
    const labels: Record<ParentAccountSummary['source'], string> = {
      LINKED_ORDER: 'Gan truc tiep tu form order',
      MATCHED_EMAIL: 'Tim thay theo email/ma tai khoan',
      MATCHED_PHONE: 'Tim thay theo so dien thoai',
      AUTO_CREATED: 'Tai khoan vua duoc tao tu dong',
    };
    return labels[source] || source;
  }

  private async resolveTeacherRecipients(order: any): Promise<TeacherRecipient[]> {
    const teacherIds: string[] = Array.from(
      new Set(
        (order.items || [])
          .map((item: any) => item?.preferredTeacherId?.toString?.() || String(item?.preferredTeacherId || ''))
          .filter((id: string) => !!id),
      ),
    );

    if (!teacherIds.length) {
      return [];
    }

    return this.userModel
      .find({
        _id: { $in: teacherIds.map((id) => new Types.ObjectId(id)) },
        role: Role.TEACHER,
      })
      .select('_id fullName')
      .lean<Array<{ _id: Types.ObjectId; fullName?: string }>>();
  }

  async buildSummary(params: {
    order: any;
    parentAccount: ParentAccountSummary;
    studentCode: string;
    invoiceRefs: InvoiceReference[];
    classIds?: string[];
  }): Promise<OrderCommunicationSummary> {
    const { order, parentAccount, studentCode, invoiceRefs, classIds = [] } = params;
    const teacherRecipients = await this.resolveTeacherRecipients(order);
    const teacherNames = teacherRecipients.map((teacher) => teacher.fullName || 'Giao vien').filter(Boolean);
    const invoiceNumbers = invoiceRefs.map((invoice) => invoice.invoiceNumber);
    const preferredSchedules = Array.from(
      new Set(
        (order.items || [])
          .map((item: any) => String(item?.preferredSchedule || '').trim())
          .filter(Boolean),
      ),
    );
    const productSummaries = (order.items || []).map((item: any) => {
      const productName = item?.productName || item?.productId || 'Goi hoc';
      const sessions = Number(item?.sessions || 0);
      const mode = this.formatTeachingMode(item?.teachingMode);
      const schedule = item?.preferredSchedule ? `, lich mong muon ${item.preferredSchedule}` : '';
      return `- ${productName}: ${sessions} buoi, ${mode}${schedule}`;
    });

    const parentAccountStatus = parentAccount.wasAutoCreated
      ? 'Tai khoan PH vua duoc tao tu dong. Sale can huong dan PH dat lai mat khau truoc khi dang nhap.'
      : 'Tai khoan PH da ton tai trong he thong.';
    const teacherStatus = teacherNames.length
      ? `GV lien quan: ${teacherNames.join(', ')}.`
      : 'Chua co GV duoc gan tu order nay.';
    const classStatus = classIds.length
      ? `Lop lien quan: ${classIds.join(', ')}.`
      : 'Chua co lop hoc chinh thuc; he thong se cap nhat sau khi xep lop.';
    const invoiceLine = invoiceNumbers.length
      ? `Hoa don da tao: ${invoiceNumbers.join(', ')}.`
      : 'Chua co hoa don duoc tao.';

    const saleMessage = this.compactLines([
      `Don ${order.orderCode} da hoan tat cho HS ${order.studentName} (${studentCode}).`,
      `PH: ${order.parentName} - ${order.parentPhone}.`,
      `Tai khoan PH: ${parentAccount.email || 'khong co email'}.`,
      `Nguon tai khoan PH: ${this.parentSourceLabel(parentAccount.source)}.`,
      parentAccountStatus,
      invoiceLine,
      teacherStatus,
      classStatus,
      productSummaries.length ? 'Tom tat san pham:' : '',
      ...productSummaries,
      'Thong diep gui PH va GV da san sang de copy nhanh.',
    ]);

    const parentMessage = this.compactLines([
      `Chao anh/chi ${order.parentName},`,
      `He thong da tao ho so hoc vien ${order.studentName} (${studentCode}) tu don ${order.orderCode}.`,
      `Tai khoan PH: ${parentAccount.email || 'vui long lien he sale/OPS de cap nhat email dang nhap'}.`,
      invoiceLine,
      classStatus,
      parentAccount.wasAutoCreated
        ? 'Tai khoan vua duoc tao, anh/chi vui long lien he sale/OPS de duoc ho tro kich hoat va dat mat khau.'
        : 'Neu anh/chi can ho tro dang nhap hoac xem hoa don, vui long nhan lai sale/OPS.',
    ]);

    const teacherMessage = teacherNames.length
      ? this.compactLines([
          `He thong vua ghi nhan don ${order.orderCode} cua hoc vien ${order.studentName} (${studentCode}).`,
          teacherStatus,
          preferredSchedules.length
            ? `Khung gio mong muon: ${preferredSchedules.join('; ')}.`
            : 'Order chua ghi nhan khung gio mong muon cu the.',
          'Luu y: day la thong tin ban giao ban dau; lich hoc va lop chinh thuc se cap nhat sau khi xep lop.',
        ])
      : '';

    return {
      saleMessage,
      parentMessage,
      teacherMessage: teacherMessage || undefined,
      parentRecipientId: new Types.ObjectId(parentAccount.parentUserId),
      teacherRecipientIds: teacherRecipients.map((teacher) => new Types.ObjectId(teacher._id)),
      generatedAt: new Date(),
    };
  }

  async sendNotifications(params: {
    order: any;
    summary: OrderCommunicationSummary;
    studentCode: string;
    parentAccount: ParentAccountSummary;
    invoiceRefs: InvoiceReference[];
  }): Promise<void> {
    const { order, summary, studentCode, parentAccount, invoiceRefs } = params;
    const invoiceNumbers = invoiceRefs.map((invoice) => invoice.invoiceNumber);

    if (summary.parentRecipientId) {
      await this.notificationsService.create({
        recipientId: summary.parentRecipientId.toString(),
        recipientRole: Role.PARENT,
        type: NotificationType.SYSTEM,
        title: `Ho so hoc tap da san sang cho ${order.studentName}`,
        message: this.compactLines([
          `Hoc vien ${studentCode} da duoc tao trong he thong.`,
          invoiceNumbers.length ? `Hoa don: ${invoiceNumbers.join(', ')}.` : undefined,
          parentAccount.wasAutoCreated
            ? 'Tai khoan vua duoc tao. Vui long lien he sale/OPS neu can ho tro kich hoat mat khau.'
            : 'Vui long vao muc Hoa don de xem chi tiet va theo doi buoc tiep theo.',
        ]),
        link: '/app/parent-invoices',
        targetId: order._id?.toString?.() || '',
        targetModule: 'ORDERS',
      });
    }

    for (const teacherId of summary.teacherRecipientIds || []) {
      await this.notificationsService.create({
        recipientId: teacherId.toString(),
        recipientRole: Role.TEACHER,
        type: NotificationType.SYSTEM,
        title: `Co thong tin hoc vien moi tu don ${order.orderCode}`,
        message: this.compactLines([
          `Hoc vien ${order.studentName} (${studentCode}) dang co yeu cau lien quan toi ban.`,
          summary.teacherMessage || undefined,
        ]),
        link: '/app/notifications',
        targetId: order._id?.toString?.() || '',
        targetModule: 'ORDERS',
      });
    }
  }
}
