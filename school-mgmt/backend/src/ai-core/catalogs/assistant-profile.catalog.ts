import { Role } from '../../common/interfaces/role.enum';
import { AiAssistantType } from '../../chatbot/schemas/ai-assistant-profile.schema';

export interface AiCoreAssistantProfile {
  assistantType: AiAssistantType;
  label: string;
  primaryRoles: readonly Role[];
  dataBoundary: string;
  defaultContextPolicy: string;
  forbidden: readonly string[];
}

export const AI_CORE_ASSISTANT_PROFILES: Record<AiAssistantType, AiCoreAssistantProfile> = {
  [AiAssistantType.DIRECTOR_OPERATIONS]: {
    assistantType: AiAssistantType.DIRECTOR_OPERATIONS,
    label: 'Tro ly Giam doc',
    primaryRoles: [Role.DIRECTOR],
    dataBoundary: 'Toan he thong, uu tien aggregate va drill-down co gioi han.',
    defaultContextPolicy: 'Nap daily tasks, pending approvals, dashboard va canh bao phu hop cau hoi.',
    forbidden: ['Khong tu thuc hien giao dich tien, xoa du lieu hoac gui hang loat khi chua xac nhan.'],
  },
  [AiAssistantType.ACCOUNTING_OPERATIONS]: {
    assistantType: AiAssistantType.ACCOUNTING_OPERATIONS,
    label: 'Tro ly Ke toan',
    primaryRoles: [Role.ACCOUNTING],
    dataBoundary: 'Hoa don, vi, ledger, payroll, cong no, P&L va export tai chinh.',
    defaultContextPolicy: 'Nap accounting dashboard, financial control va queue tai chinh.',
    forbidden: ['Khong quan tri user hoac AI token.', 'Khong xem ngoai scope tai chinh duoc phep.'],
  },
  [AiAssistantType.OPS_OPERATIONS]: {
    assistantType: AiAssistantType.OPS_OPERATIONS,
    label: 'Tro ly Van hanh',
    primaryRoles: [Role.OPS],
    dataBoundary: 'Lop, session, hoc sinh, giao vien, ticket va pending operations.',
    defaultContextPolicy: 'Nap ops dashboard, daily tasks, sessions/classes/tickets theo filter nho.',
    forbidden: ['Khong thay doi so du vi.', 'Khong duyet chi tien/luong neu khong duoc phep.'],
  },
  [AiAssistantType.TEACHER_SUPPORT]: {
    assistantType: AiAssistantType.TEACHER_SUPPORT,
    label: 'Tro ly giao vien',
    primaryRoles: [Role.TEACHER],
    dataBoundary: 'Chi du lieu cua giao vien dang dang nhap.',
    defaultContextPolicy: 'Nap teacher dashboard, my sessions, pending report va ticket cua minh.',
    forbidden: ['Khong xem luong nguoi khac.', 'Khong xem session/lop khong duoc phan cong.'],
  },
  [AiAssistantType.EXPERIENCE_TEACHER_SUPPORT]: {
    assistantType: AiAssistantType.EXPERIENCE_TEACHER_SUPPORT,
    label: 'Tro ly giao vien review',
    primaryRoles: [Role.EXPERIENCE_TEACHER],
    dataBoundary: 'Bai tap, quiz, hoc lieu/rubric va queue review trong role-scope.',
    defaultContextPolicy: 'Nap homework grading, quiz grading, material metadata/chunk theo filter nho.',
    forbidden: ['Khong xem tai chinh.', 'Khong sua session ngoai pham vi review.', 'Khong cham diem neu chua co action draft va xac nhan.'],
  },
  [AiAssistantType.PARENT_SUPPORT]: {
    assistantType: AiAssistantType.PARENT_SUPPORT,
    label: 'Cham soc phu huynh',
    primaryRoles: [Role.PARENT],
    dataBoundary: 'Chi du lieu cua phu huynh va cac con lien ket.',
    defaultContextPolicy: 'Nap parent dashboard, my children sessions, invoices, wallet va tickets cua minh.',
    forbidden: ['Khong xem phu huynh/hoc sinh khac.'],
  },
  [AiAssistantType.STUDENT_SUPPORT]: {
    assistantType: AiAssistantType.STUDENT_SUPPORT,
    label: 'Ho tro hoc sinh',
    primaryRoles: [Role.STUDENT],
    dataBoundary: 'Chi lich hoc, bai tap, quiz va hoc lieu cua hoc sinh dang dang nhap.',
    defaultContextPolicy: 'Chi nap noi dung hoc tap va lich hoc ca nhan.',
    forbidden: ['Khong xem tai chinh phu huynh.', 'Khong xem hoc sinh khac.'],
  },
  [AiAssistantType.SALE_OPERATIONS]: {
    assistantType: AiAssistantType.SALE_OPERATIONS,
    label: 'Tro ly Sales',
    primaryRoles: [Role.SALE],
    dataBoundary: 'Lead, order, conversation va trial trong scope sale.',
    defaultContextPolicy: 'Nap sales dashboard theo saleId, lead follow-up, order pipeline va conversation dang xu ly.',
    forbidden: ['Khong xem P&L day du.', 'Khong duyet hoa don/nap tien.'],
  },
  [AiAssistantType.ADS_OPERATIONS]: {
    assistantType: AiAssistantType.ADS_OPERATIONS,
    label: 'Tro ly Ads',
    primaryRoles: [Role.ADSMANAGER],
    dataBoundary: 'Ads account, ad group, cost, analytics va suggestions.',
    defaultContextPolicy: 'Nap ads analytics/actions-required; token/sync chi duoc preview khi can.',
    forbidden: ['Khong thay doi ngan sach/token/sync neu chua xac nhan.'],
  },
  [AiAssistantType.SHAREHOLDER_INSIGHTS]: {
    assistantType: AiAssistantType.SHAREHOLDER_INSIGHTS,
    label: 'Bao cao co dong',
    primaryRoles: [Role.SHAREHOLDER],
    dataBoundary: 'Chi aggregate/report duoc phep, khong PII chi tiet mac dinh.',
    defaultContextPolicy: 'Nap aggregate finance, retention va investor metrics.',
    forbidden: ['Khong thao tac ghi.', 'Khong xem audit/user/chat noi bo chi tiet.'],
  },
  [AiAssistantType.INTERNAL_SUPPORT]: {
    assistantType: AiAssistantType.INTERNAL_SUPPORT,
    label: 'Ho tro noi bo',
    primaryRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE, Role.ADSMANAGER],
    dataBoundary: 'Huong dan va tra cuu theo role dang dang nhap.',
    defaultContextPolicy: 'Uu tien guide/static docs, chi doc tool duoc role cho phep.',
    forbidden: ['Khong vuot role cua user dang dang nhap.'],
  },
  [AiAssistantType.LEAD_CARE]: {
    assistantType: AiAssistantType.LEAD_CARE,
    label: 'Cham soc lead',
    primaryRoles: [Role.SALE, Role.OPS, Role.DIRECTOR],
    dataBoundary: 'Conversation, lead va order trong pipeline cham soc.',
    defaultContextPolicy: 'Nap context hoi thoai hien tai, lead lien quan va product/order can tu van.',
    forbidden: ['Khong tao cam ket hoc phi/khuyen mai ngoai product/order duoc phep.'],
  },
};

export function getAiCoreAssistantProfile(assistantType: AiAssistantType) {
  return AI_CORE_ASSISTANT_PROFILES[assistantType];
}

export function inferAssistantTypeForRole(role: Role): AiAssistantType {
  switch (role) {
    case Role.DIRECTOR:
      return AiAssistantType.DIRECTOR_OPERATIONS;
    case Role.ACCOUNTING:
      return AiAssistantType.ACCOUNTING_OPERATIONS;
    case Role.OPS:
      return AiAssistantType.OPS_OPERATIONS;
    case Role.TEACHER:
      return AiAssistantType.TEACHER_SUPPORT;
    case Role.EXPERIENCE_TEACHER:
      return AiAssistantType.EXPERIENCE_TEACHER_SUPPORT;
    case Role.PARENT:
      return AiAssistantType.PARENT_SUPPORT;
    case Role.STUDENT:
      return AiAssistantType.STUDENT_SUPPORT;
    case Role.SALE:
      return AiAssistantType.SALE_OPERATIONS;
    case Role.ADSMANAGER:
      return AiAssistantType.ADS_OPERATIONS;
    case Role.SHAREHOLDER:
      return AiAssistantType.SHAREHOLDER_INSIGHTS;
    default:
      return AiAssistantType.INTERNAL_SUPPORT;
  }
}
