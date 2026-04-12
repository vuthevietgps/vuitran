export type FinancialReportBasis = 'cash' | 'accrual';

export function resolveFinancialBasis(basis?: string): FinancialReportBasis {
  return basis === 'accrual' ? 'accrual' : 'cash';
}

export function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function roundMetric(value: number, digits = 0): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(digits));
}

export function roundOptionalMetric(value: number | null | undefined, digits = 0): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

export function normalizeTrendMonthCount(value?: number | string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 6;
  }
  return Math.min(24, Math.max(1, Math.trunc(parsed)));
}

export function fitLogCurve(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
  const n = xValues.length;
  if (n < 2) return { a: 0, b: 0, rSquared: 0 };

  const X = xValues.map(x => Math.log(x + 1));
  const Y = yValues;

  const sumX = X.reduce((s, v) => s + v, 0);
  const sumY = Y.reduce((s, v) => s + v, 0);
  const sumXY = X.reduce((s, v, i) => s + v * Y[i], 0);
  const sumXX = X.reduce((s, v) => s + v * v, 0);

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  const meanY = sumY / n;
  const ssTotal = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssResidual = Y.reduce((s, y, i) => s + (y - (a * X[i] + b)) ** 2, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { a, b, rSquared: Math.max(0, rSquared) };
}
