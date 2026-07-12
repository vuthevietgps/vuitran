import { DIRECTOR_AI_QUESTION_BANK } from './director-ai-question-bank';

describe('DIRECTOR_AI_QUESTION_BANK', () => {
  it('contains 50 to 100 director test questions', () => {
    expect(DIRECTOR_AI_QUESTION_BANK.length).toBeGreaterThanOrEqual(50);
    expect(DIRECTOR_AI_QUESTION_BANK.length).toBeLessThanOrEqual(100);
  });

  it('uses unique stable ids', () => {
    const ids = DIRECTOR_AI_QUESTION_BANK.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers core operating categories', () => {
    const categories = Array.from(new Set(DIRECTOR_AI_QUESTION_BANK.map((item) => item.category)));
    expect(categories).toEqual(expect.arrayContaining([
      'DAILY',
      'APPROVAL',
      'FINANCE',
      'SALES',
      'OPERATIONS',
      'ADS',
      'HR',
      'AUDIT',
      'GUIDE',
      'FUZZY',
      'ACTION',
    ]));
  });

  it('covers create-data draft flows and confirmation flows', () => {
    const actions = DIRECTOR_AI_QUESTION_BANK
      .map((item) => item.expectedAction)
      .filter(Boolean);
    const modes = DIRECTOR_AI_QUESTION_BANK.map((item) => item.expectedMode);

    expect(actions).toEqual(expect.arrayContaining([
      'CREATE_STUDENT',
      'CREATE_CLASS',
      'CREATE_LEAD',
      'CREATE_TICKET',
    ]));
    expect(modes).toEqual(expect.arrayContaining([
      'ACTION_MISSING_FIELDS',
      'ACTION_PREVIEW',
      'ACTION_CONFIRM',
      'ACTION_REJECT',
    ]));
  });
});
