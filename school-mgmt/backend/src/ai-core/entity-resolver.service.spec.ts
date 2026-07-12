import { AiEntityResolverService } from './entity-resolver.service';
import { AiEntityCandidate, AiEntityType } from './ai-core.types';

function service() {
  return new AiEntityResolverService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

function candidate(input: Partial<AiEntityCandidate>): AiEntityCandidate {
  return {
    type: AiEntityType.STUDENT,
    id: input.id || '64b000000000000000000001',
    label: input.label || 'Candidate',
    code: input.code,
    score: input.score ?? 0.8,
    confidence: input.confidence || 'MEDIUM',
    matchedFields: input.matchedFields || ['fullName'],
    summary: input.summary || {},
  };
}

describe('AiEntityResolverService', () => {
  it('normalizes Vietnamese accents and casing for matching', () => {
    const resolver = service();

    expect(resolver.normalizeText('Nguyễn Thị Hằng')).toBe('nguyen thi hang');
    expect(resolver.normalizeText('  LỚP-10A_2026  ')).toBe('lop 10a 2026');
  });

  it('scores missing accents and a small typo as a strong name match', () => {
    const resolver = service();

    const missingAccentScore = resolver.scoreValues('xem hoc vien Nguyen Thi Hang', [
      { field: 'fullName', value: 'Nguyễn Thị Hằng' },
    ]);
    const typoScore = resolver.scoreValues('xem hoc vien Nguyen Thi Hagn', [
      { field: 'fullName', value: 'Nguyễn Thị Hằng' },
    ]);

    expect(missingAccentScore.score).toBeGreaterThanOrEqual(0.84);
    expect(typoScore.score).toBeGreaterThanOrEqual(0.8);
    expect(typoScore.matchedFields).toContain('fullName');
  });

  it('marks close candidates as ambiguous instead of guessing', () => {
    const resolver = service();
    const result = resolver.buildResolution('Nam lop 10', AiEntityType.STUDENT, [
      candidate({ id: '64b000000000000000000001', label: 'Nguyen Van Nam', score: 0.88 }),
      candidate({ id: '64b000000000000000000002', label: 'Tran Hoai Nam', score: 0.83 }),
    ]);

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.needsConfirmation).toBe(true);
    expect(result.selected).toBeUndefined();
  });

  it('resolves a unique high-confidence candidate', () => {
    const resolver = service();
    const result = resolver.buildResolution('STU-2026-0001', AiEntityType.STUDENT, [
      candidate({
        id: '64b000000000000000000001',
        label: 'Nguyen Thi Hang',
        code: 'STU-2026-0001',
        score: 0.98,
        confidence: 'HIGH',
        matchedFields: ['studentCode'],
      }),
    ]);

    expect(result.status).toBe('RESOLVED');
    expect(result.needsConfirmation).toBe(false);
    expect(result.selected?.code).toBe('STU-2026-0001');
  });
});
