export type SaleAiQuestionCategory =
  | 'DAILY_PRIORITY'
  | 'FOLLOW_UP'
  | 'PIPELINE'
  | 'ORDER'
  | 'TRIAL'
  | 'COMMISSION'
  | 'CONVERSATION'
  | 'GUIDE'
  | 'ACTION_DRAFT';

export type SaleAiExpectedMode =
  | 'NEXT_BEST_ACTIONS'
  | 'READ_CONTEXT'
  | 'DRILL_DOWN'
  | 'GUIDE'
  | 'ACTION_PREVIEW';

export interface SaleAiQuestionCase {
  id: string;
  category: SaleAiQuestionCategory;
  question: string;
  expectedMode: SaleAiExpectedMode;
  expectedSituation?: string;
  expectedContextKeys: readonly string[];
  expectedBehavior: string;
}

export const SALE_AI_QUESTION_BANK: readonly SaleAiQuestionCase[] = [
  {
    id: 'SAL-001',
    category: 'DAILY_PRIORITY',
    question: 'Hom nay toi can lam gi de chot doanh thu?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions'],
    expectedBehavior: 'Xep rank lead/order/trial/conversation can xu ly, neu bang chung va buoc tiep theo.',
  },
  {
    id: 'SAL-002',
    category: 'DAILY_PRIORITY',
    question: 'Pipeline cua toi dang nghen o dau va viec nao xu ly truoc?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions', 'sale_conversations'],
    expectedBehavior: 'Dung packet scoring, khong chi lap lai count dashboard.',
  },
  {
    id: 'SAL-003',
    category: 'FOLLOW_UP',
    question: 'Lead nao can follow-up hom nay?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_daily_followups',
    expectedContextKeys: ['sale_followups_due', 'sale_lead_pipeline'],
    expectedBehavior: 'Sap lead theo nextFollowUp/qua han, neu ma lead, ten phu huynh va han lien he.',
  },
  {
    id: 'SAL-004',
    category: 'FOLLOW_UP',
    question: 'Lead nao qua han cham soc va can cuu truoc?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions'],
    expectedBehavior: 'Uu tien lead qua han/stale co evidence thay vi chi dua danh sach thuan.',
  },
  {
    id: 'SAL-005',
    category: 'PIPELINE',
    question: 'Ty le chuyen doi lead cua toi thang nay the nao?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_lead_pipeline_review',
    expectedContextKeys: ['sales_dashboard', 'sale_lead_pipeline'],
    expectedBehavior: 'Neu conversionRate, byStatus va noi ro khoang ngay/source context.',
  },
  {
    id: 'SAL-006',
    category: 'PIPELINE',
    question: 'Lead dang consulting/interested nao dang bi nguoi?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_lead_pipeline_review',
    expectedContextKeys: ['sale_my_leads', 'sale_followups_due'],
    expectedBehavior: 'Can neu stale/lastContact/nextFollowUp neu context co.',
  },
  {
    id: 'SAL-007',
    category: 'ORDER',
    question: 'Order nao cua toi can bo sung ho so?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_order_pipeline_review',
    expectedContextKeys: ['sale_order_pipeline', 'sale_my_orders'],
    expectedBehavior: 'Loc NEEDS_INFO/DRAFT/SUBMITTED, neu ma order, amount, trang thai va buoc tiep.',
  },
  {
    id: 'SAL-008',
    category: 'ORDER',
    question: 'Order nao dang cho duyet co nguy co khong tinh doanh thu thang nay?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions', 'sale_my_orders'],
    expectedBehavior: 'Lien ket trang thai order voi doanh thu/commission va viec can lam tiep.',
  },
  {
    id: 'SAL-009',
    category: 'TRIAL',
    question: 'Hoc thu nao dang waiting decision?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_trial_followup',
    expectedContextKeys: ['sale_trial_summary', 'sale_trial_enrollments'],
    expectedBehavior: 'Uu tien waiting decision, neu trialCode, hoc sinh, PH va next step convert/reject.',
  },
  {
    id: 'SAL-010',
    category: 'TRIAL',
    question: 'Trial nao can chot sau test truoc khi lead nguoi?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions'],
    expectedBehavior: 'Waiting decision phai duoc xep hang cao hon pending trial thong thuong.',
  },
  {
    id: 'SAL-011',
    category: 'COMMISSION',
    question: 'Hoa hong cua toi thang nay theo order nao?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_commission_personal',
    expectedContextKeys: ['sale_commission_report', 'sales_dashboard'],
    expectedBehavior: 'Chi tra hoa hong cua sale dang dang nhap, khong sua hoa hong.',
  },
  {
    id: 'SAL-012',
    category: 'COMMISSION',
    question: 'Hoa hong va doanh thu cua toi co lech voi order cho duyet khong?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_revenue_commitment_packet',
    expectedContextKeys: ['sale_next_best_actions', 'sale_commission_report'],
    expectedBehavior: 'So sanh commission/revenue summary voi order pipeline, neu thieu target thi noi ro.',
  },
  {
    id: 'SAL-013',
    category: 'CONVERSATION',
    question: 'Conversation nao dang can toi phan hoi?',
    expectedMode: 'READ_CONTEXT',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_conversations', 'sale_next_best_actions'],
    expectedBehavior: 'Chi doc hoi thoai assigned cho sale, khong gui tin khi chua confirm.',
  },
  {
    id: 'SAL-014',
    category: 'CONVERSATION',
    question: 'Soan tin nhan cho phu huynh cua lead nay',
    expectedMode: 'DRILL_DOWN',
    expectedContextKeys: ['lead_detail', 'sale_conversations'],
    expectedBehavior: 'Can lead/conversation cu the truoc khi soan noi dung ca nhan hoa.',
  },
  {
    id: 'SAL-015',
    category: 'GUIDE',
    question: 'Quy trinh dau ngay cua sale la gi?',
    expectedMode: 'GUIDE',
    expectedSituation: 'system_guide',
    expectedContextKeys: ['system_guide', 'sale_guide'],
    expectedBehavior: 'Tra loi bang routine sale va man hinh can mo.',
  },
  {
    id: 'SAL-016',
    category: 'ACTION_DRAFT',
    question: 'Cap nhat lead nay sang INTERESTED va hen follow-up ngay mai',
    expectedMode: 'ACTION_PREVIEW',
    expectedContextKeys: ['lead_detail'],
    expectedBehavior: 'Tao draft update lead neu entity ro, khong noi da cap nhat khi chua confirm.',
  },
  {
    id: 'SAL-017',
    category: 'ACTION_DRAFT',
    question: 'Them lich su lien he: da goi phu huynh, phu huynh muon hoc thu',
    expectedMode: 'ACTION_PREVIEW',
    expectedContextKeys: ['lead_detail'],
    expectedBehavior: 'Tao draft add contact neu lead ro, bat buoc preview noi dung.',
  },
  {
    id: 'SAL-018',
    category: 'ORDER',
    question: 'Don hang nao da approved nhung can handover tiep?',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions'],
    expectedBehavior: 'Approved order co score thap hon needs-info nhung van co next step handover.',
  },
  {
    id: 'SAL-019',
    category: 'PIPELINE',
    question: 'Lead nao co gia tri uoc tinh cao nhung chua co lich follow-up?',
    expectedMode: 'DRILL_DOWN',
    expectedContextKeys: ['sale_my_leads', 'sale_lead_pipeline'],
    expectedBehavior: 'Can list lead co estimatedValue/nextFollowUp; neu context khong co thi noi can filter bo sung.',
  },
  {
    id: 'SAL-020',
    category: 'DAILY_PRIORITY',
    question: 'Cho toi top 5 viec sale uu tien trong ngay',
    expectedMode: 'NEXT_BEST_ACTIONS',
    expectedSituation: 'sale_next_best_actions_packet',
    expectedContextKeys: ['sale_next_best_actions'],
    expectedBehavior: 'Tra top 5 theo score, moi item co evidence va route.',
  },
];
