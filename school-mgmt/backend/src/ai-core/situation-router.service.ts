import { Injectable } from '@nestjs/common';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import {
  AI_CORE_SITUATION_CATALOG,
  getAiCoreSituationDefinition,
} from './catalogs/situation.catalog';
import { AiSituationDefinition } from './ai-core.types';

const MODE_TO_SITUATION: Record<string, string> = {
  GUIDE: 'system_guide',
  OVERVIEW: 'executive_overview',
  FINANCE: 'finance_risk',
  ACCOUNTING: 'accounting_queue',
  OPERATIONS: 'ops_daily_sla_packet',
  OPS: 'ops_daily_sla_packet',
  SALES: 'sale_next_best_actions_packet',
  ADS: 'ads_actions',
  HR: 'operations_bottleneck',
};

@Injectable()
export class AiSituationRouterService {
  route(
    message: string,
    assistantType: AiAssistantType,
    user: JwtPayload,
    contextMode?: string,
  ): AiSituationDefinition {
    const normalized = this.normalizeText(message);
    const modeKey = contextMode?.trim().toUpperCase();
    const accountingSpecificKey = this.resolveAccountingSpecificSituationKey(
      normalized,
      modeKey,
      assistantType,
      user,
    );
    if (accountingSpecificKey) {
      const situation = getAiCoreSituationDefinition(accountingSpecificKey);
      if (situation && this.isAllowedForActor(situation, assistantType, user)) {
        return situation;
      }
    }

    const modeSituationKey = modeKey
      ? this.resolveModeSituationKey(modeKey, assistantType, user)
      : undefined;
    if (modeSituationKey) {
      const situation = getAiCoreSituationDefinition(modeSituationKey);
      if (situation && this.isAllowedForActor(situation, assistantType, user)) {
        return situation;
      }
    }

    const opsPacket = this.resolveOpsDailyPacket(normalized, assistantType, user);
    if (opsPacket) {
      return opsPacket;
    }

    const experienceTeacherPacket = this.resolveExperienceTeacherDailyPacket(normalized, assistantType, user);
    if (experienceTeacherPacket) {
      return experienceTeacherPacket;
    }

    const scored = AI_CORE_SITUATION_CATALOG
      .filter((situation) => this.isAllowedForActor(situation, assistantType, user))
      .map((situation) => {
        const keywordScore = situation.triggerKeywords.reduce((sum, keyword) => {
          const normalizedKeyword = this.normalizeText(keyword);
          if (!normalizedKeyword || !normalized.includes(normalizedKeyword)) return sum;
          return sum + Math.max(1, normalizedKeyword.length);
        }, 0);
        return {
          situation,
          score: keywordScore > 0 ? keywordScore + this.specificityBonus(situation) : 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored[0]) {
      return scored[0].situation;
    }

    const preferredFallbacks = assistantType === AiAssistantType.EXPERIENCE_TEACHER_SUPPORT
      ? ['experience_teacher_daily_review_packet', 'daily_work_queue', 'system_guide']
      : ['daily_work_queue', 'executive_overview', 'teacher_or_parent_summary', 'system_guide'];
    for (const key of preferredFallbacks) {
      const fallback = getAiCoreSituationDefinition(key);
      if (fallback && this.isAllowedForActor(fallback, assistantType, user)) {
        return fallback;
      }
    }

    return AI_CORE_SITUATION_CATALOG.find((situation) =>
      this.isAllowedForActor(situation, assistantType, user),
    ) || AI_CORE_SITUATION_CATALOG[0];
  }

  private resolveModeSituationKey(
    modeKey: string,
    assistantType: AiAssistantType,
    user: JwtPayload,
  ) {
    if (assistantType === AiAssistantType.SHAREHOLDER_INSIGHTS || user.role === Role.SHAREHOLDER) {
      if (modeKey === 'OVERVIEW') return 'shareholder_investor_brief';
      if (modeKey === 'FINANCE') return 'shareholder_finance_risk_packet';
    }

    return MODE_TO_SITUATION[modeKey];
  }

  private resolveOpsDailyPacket(
    normalized: string,
    assistantType: AiAssistantType,
    user: JwtPayload,
  ): AiSituationDefinition | undefined {
    if (assistantType !== AiAssistantType.OPS_OPERATIONS || user.role !== Role.OPS) {
      return undefined;
    }

    const hasDailyIntent = /(hom nay|dau ngay|can xu ly|can lam|uu tien|viec)/.test(normalized);
    const hasOpsSubject = /(van hanh|ops|sla|session|buoi hoc|ticket|lop|giao vien|attendance|diem danh|hoc thu|test)/.test(normalized);
    if (!hasDailyIntent || !hasOpsSubject) {
      return undefined;
    }

    const situation = getAiCoreSituationDefinition('ops_daily_sla_packet');
    return situation && this.isAllowedForActor(situation, assistantType, user)
      ? situation
      : undefined;
  }

  private resolveExperienceTeacherDailyPacket(
    normalized: string,
    assistantType: AiAssistantType,
    user: JwtPayload,
  ): AiSituationDefinition | undefined {
    if (assistantType !== AiAssistantType.EXPERIENCE_TEACHER_SUPPORT || user.role !== Role.EXPERIENCE_TEACHER) {
      return undefined;
    }

    if (!/(hom nay|dau ngay|can lam|can xu ly|uu tien|viec)/.test(normalized)) {
      return undefined;
    }

    const situation = getAiCoreSituationDefinition('experience_teacher_daily_review_packet');
    return situation && this.isAllowedForActor(situation, assistantType, user)
      ? situation
      : undefined;
  }

  private resolveAccountingSpecificSituationKey(
    normalizedMessage: string,
    modeKey: string | undefined,
    assistantType: AiAssistantType,
    user: JwtPayload,
  ) {
    if (assistantType !== AiAssistantType.ACCOUNTING_OPERATIONS || user.role !== Role.ACCOUNTING) {
      return undefined;
    }

    if (modeKey && !['AUTO', 'ACCOUNTING', 'FINANCE'].includes(modeKey)) {
      return undefined;
    }

    const routes: Array<{ key: string; keywords: string[] }> = [
      {
        key: 'accounting_bank_fund_expense_control',
        keywords: [
          'ngan hang',
          'bank',
          'tai khoan ngan hang',
          'giao dich ngan hang',
          'bank transaction',
          'quy',
          'fund',
          'giao dich quy',
          'chi phi',
          'expense',
          'opex',
        ],
      },
      {
        key: 'accounting_loan_debt_control',
        keywords: ['khoan vay', 'loan', 'no vay', 'lich tra vay', 'tra vay', 'den han vay', 'qua han vay'],
      },
      {
        key: 'accounting_payroll_payout_packet',
        keywords: ['payroll', 'bang luong', 'tra luong', 'pending payout', 'chu ky luong', 'giu luong'],
      },
      {
        key: 'accounting_month_end_close_packet',
        keywords: ['chot so', 'cuoi thang', 'month end', 'dong so', 'closing', 'doi soat cuoi thang'],
      },
      {
        key: 'accounting_invoice_wallet_reconciliation',
        keywords: ['hoa don cho duyet', 'top-up', 'topup', 'wallet', 'vi', 'ledger', 'nap tien', 'doi soat'],
      },
      {
        key: 'accounting_collections_aging_packet',
        keywords: ['cong no', 'aging', 'thu tien', 'hoa don tre', 'collection'],
      },
    ];

    return routes.find((route) => this.hasAnyKeyword(normalizedMessage, route.keywords))?.key;
  }

  private hasAnyKeyword(normalizedMessage: string, keywords: string[]) {
    return keywords.some((keyword) => normalizedMessage.includes(this.normalizeText(keyword)));
  }

  private isAllowedForActor(
    situation: AiSituationDefinition,
    assistantType: AiAssistantType,
    user: JwtPayload,
  ) {
    return situation.allowedAssistantTypes.includes(assistantType)
      && situation.allowedRoles.includes(user.role);
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase();
  }

  private specificityBonus(situation: AiSituationDefinition) {
    return situation.allowedAssistantTypes.length === 1 ? 8 : 0;
  }
}
