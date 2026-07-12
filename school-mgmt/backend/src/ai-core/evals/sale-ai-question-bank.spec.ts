import { SALE_AI_QUESTION_BANK } from './sale-ai-question-bank';

describe('SALE_AI_QUESTION_BANK', () => {
  it('contains a focused sale evaluation set', () => {
    expect(SALE_AI_QUESTION_BANK.length).toBeGreaterThanOrEqual(20);
    expect(SALE_AI_QUESTION_BANK.length).toBeLessThanOrEqual(60);
  });

  it('uses unique stable ids', () => {
    const ids = SALE_AI_QUESTION_BANK.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the core sale operating categories', () => {
    const categories = Array.from(new Set(SALE_AI_QUESTION_BANK.map((item) => item.category)));

    expect(categories).toEqual(expect.arrayContaining([
      'DAILY_PRIORITY',
      'FOLLOW_UP',
      'PIPELINE',
      'ORDER',
      'TRIAL',
      'COMMISSION',
      'CONVERSATION',
      'GUIDE',
      'ACTION_DRAFT',
    ]));
  });

  it('requires next-best-action coverage for sale prioritization', () => {
    const nextBestActionCases = SALE_AI_QUESTION_BANK.filter(
      (item) => item.expectedMode === 'NEXT_BEST_ACTIONS',
    );

    expect(nextBestActionCases.length).toBeGreaterThanOrEqual(6);
    expect(nextBestActionCases.every((item) =>
      item.expectedContextKeys.includes('sale_next_best_actions'),
    )).toBe(true);
  });
});
