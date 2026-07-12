import { Injectable } from '@nestjs/common';

const WRITE_CLAIM_PATTERNS = [
  'da duyet',
  'da tu choi',
  'da huy',
  'da chuyen tien',
  'da dieu chinh',
  'da tao',
  'da gui thong bao',
  'da khoa',
  'da mo khoa',
  'da thuc hien',
];

@Injectable()
export class AiResponseGuardService {
  guardReadOnlyAnswer(answer: string) {
    const normalized = this.normalizeText(answer);
    const hasWriteClaim = WRITE_CLAIM_PATTERNS.some((pattern) => normalized.includes(pattern));
    if (!hasWriteClaim) return answer;

    return [
      'Luu y: AI core hien chi dang o che do doc du lieu va de xuat. Chua co thao tac ghi/duyet/gui/xoa nao duoc thuc hien.',
      '',
      answer,
    ].join('\n');
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
  }
}
