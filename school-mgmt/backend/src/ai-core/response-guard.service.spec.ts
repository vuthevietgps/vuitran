import { AiResponseGuardService } from './response-guard.service';

describe('AiResponseGuardService', () => {
  let service: AiResponseGuardService;

  beforeEach(() => {
    service = new AiResponseGuardService();
  });

  it('flags Vietnamese write claims that contain đ/Đ and accents', () => {
    const answer = 'Đã duyệt hóa đơn INV-001 và đã gửi thông báo cho phụ huynh.';

    expect(service.guardReadOnlyAnswer(answer)).toContain(
      'AI core hien chi dang o che do doc du lieu va de xuat',
    );
  });

  it('leaves read-only answers unchanged', () => {
    const answer = 'Hoa don INV-001 dang cho duyet, can kiem tra chung tu truoc.';

    expect(service.guardReadOnlyAnswer(answer)).toBe(answer);
  });
});
