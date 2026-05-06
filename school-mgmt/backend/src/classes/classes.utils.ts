import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ClassMode,
  ClassUpdateRequestStatus,
  DurationSnapshotSource,
  OfflineAssignmentRequestStatus,
  PendingClassUpdateType,
  ClassCoTeacherRole,
  PricingSnapshotSource,
  StudentConfigSlotType,
} from './schemas/class.schema';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { getClassPricingConfigAt } from './student-config.utils';

// ══════════════════════════════════════════════════════════════════
// NUMBER / MONEY HELPERS
// ══════════════════════════════════════════════════════════════════

export function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function pickFirstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const normalized = Number(value);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
  }
  return 0;
}

export function roundMoneyToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 1000) * 1000;
}

export function roundMoneyDownToThousand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / 1000) * 1000;
}

export function floorSessionCount(value: number): number {
  const normalized = Number.isFinite(value) ? value : 0;
  return normalized > 0 ? Math.floor(normalized) : 0;
}

// ══════════════════════════════════════════════════════════════════
// IDENTITY / ROLE HELPERS
// ══════════════════════════════════════════════════════════════════

export function getActorId(actor?: JwtPayload): string | null {
  return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
}

export function isManagerRole(role?: Role): boolean {
  return role === Role.DIRECTOR || role === Role.OPS;
}

// ══════════════════════════════════════════════════════════════════
// DTO HELPERS
// ══════════════════════════════════════════════════════════════════

export function resolveRequestedUpdateType(dto?: Pick<UpdateClassDto, 'requestType'>): PendingClassUpdateType {
  return dto?.requestType === PendingClassUpdateType.DURATION_CHANGE
    ? PendingClassUpdateType.DURATION_CHANGE
    : PendingClassUpdateType.GENERAL;
}

export function stripUpdateMetaFields<T extends object>(dto: T): Omit<T, 'requestType'> {
  const { requestType, ...rest } = dto as T & { requestType?: PendingClassUpdateType };
  return rest;
}

export function sanitizeSaleUpdateDto(dto: UpdateClassDto): UpdateClassDto {
  const { saleId, studentIds, invoiceId, requestType, code, ...allowed } = dto;
  return allowed;
}

export function sanitizeDurationUpdateDto(dto: UpdateClassDto): UpdateClassDto {
  const requestedChanges = new UpdateClassDto();
  requestedChanges.requestType = PendingClassUpdateType.DURATION_CHANGE;
  if (dto.baseDuration !== undefined) {
    requestedChanges.baseDuration = dto.baseDuration;
  }
  if (dto.sessionDuration !== undefined) {
    requestedChanges.sessionDuration = dto.sessionDuration;
  }
  return requestedChanges;
}

// ══════════════════════════════════════════════════════════════════
// OBJECT ID HELPERS
// ══════════════════════════════════════════════════════════════════

export function isSameObjectId(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): string => {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return (value as any)?.toString?.() || '';
  };

  return normalize(left) === normalize(right);
}

export function objectIdToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return (value as any)?._id?.toString?.() || (value as any)?.toString?.() || null;
}

export function isClassTeacherMember(classroom: any, teacherId: string): boolean {
  if (!classroom || !teacherId) {
    return false;
  }

  if (objectIdToString(classroom?.teacher) === teacherId) {
    return true;
  }

  const coTeachers = Array.isArray(classroom?.coTeachers) ? classroom.coTeachers : [];
  if (coTeachers.some((entry: any) => objectIdToString(entry?.teacherId) === teacherId)) {
    return true;
  }

  const substitutes = Array.isArray(classroom?.substituteTeachers) ? classroom.substituteTeachers : [];
  return substitutes.some((entry: any) => objectIdToString(entry?.teacherId) === teacherId);
}

// ══════════════════════════════════════════════════════════════════
// CLASS CODE / NAME HELPERS
// ══════════════════════════════════════════════════════════════════

export function sanitizeClassCodeToken(value?: string | null, fallback = 'AUTO'): string {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-8);
  return normalized || fallback;
}

export function buildAutoClassName(options: {
  studentName?: string | null;
  productName?: string | null;
  classMode?: string | null;
}): string {
  const productName = String(options.productName || '').trim();
  const studentName = String(options.studentName || '').trim();
  const fallbackMode = String(options.classMode || '').toUpperCase() === ClassMode.OFFLINE
    ? 'OFFLINE'
    : 'ONLINE';
  const label = productName || fallbackMode;
  return studentName ? `Lop ${label} - ${studentName}` : `Lop ${label}`;
}

// ══════════════════════════════════════════════════════════════════
// HISTORY / FORMATTING HELPERS
// ══════════════════════════════════════════════════════════════════

export function getClassHistoryFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: 'Ten lop',
    code: 'Ma lop',
    teacherId: 'Giao vien',
    coTeachers: 'Giao vien phu',
    productPackageId: 'Goi san pham',
    classMode: 'Loai lop',
    pricePerSession: 'Gia theo buoi',
    teacherPayPerSession: 'Luong GV/buoi',
    teacherPayPerStudent: 'Luong GV/HS',
    baseDuration: 'Thoi luong co so',
    sessionDuration: 'Thoi luong buoi hoc',
    subject: 'Mon hoc',
    grade: 'Khoi lop',
    learningGoals: 'Muc tieu hoc',
    maxStudents: 'Si so toi da',
  };
  return labels[field] || field;
}

export function formatCurrencyForHistory(value: unknown): string {
  const amount = toSafeNumber(value, 0);
  return `${amount.toLocaleString('vi-VN')}d`;
}

export function formatClassModeLabel(value: unknown): string {
  return String(value || '').toUpperCase() === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
}

export function formatClassHistoryValue(
  field: string,
  value: unknown,
  lookupMaps?: {
    teacherNames?: Map<string, string>;
    productNames?: Map<string, string>;
  },
): string {
  if (value === null || value === undefined) {
    return '(trong)';
  }

  if (typeof value === 'string' && !value.trim()) {
    return '(trong)';
  }

  switch (field) {
    case 'teacherId': {
      const teacherId = objectIdToString(value);
      if (!teacherId) return '(trong)';
      return lookupMaps?.teacherNames?.get(teacherId) || teacherId;
    }
    case 'coTeachers': {
      const coTeachers = Array.isArray(value) ? value : [];
      if (!coTeachers.length) return '(trong)';
      return coTeachers
        .map((entry: any) => {
          const teacherId = objectIdToString(entry?.teacherId);
          const teacherName = teacherId
            ? (lookupMaps?.teacherNames?.get(teacherId) || teacherId)
            : '(trong)';
          const role = String(entry?.role || ClassCoTeacherRole.SUPPORT);
          const flags = [
            entry?.canManageAttendance !== false ? 'attendance' : null,
            entry?.canManageReports !== false ? 'reports' : null,
            entry?.canCreateLink !== false ? 'link' : null,
          ].filter(Boolean).join(',');
          return `${teacherName} [${role}${flags ? `; ${flags}` : ''}]`;
        })
        .join(' | ');
    }
    case 'productPackageId': {
      const productId = objectIdToString(value);
      if (!productId) return '(trong)';
      return lookupMaps?.productNames?.get(productId) || productId;
    }
    case 'classMode':
      return formatClassModeLabel(value);
    case 'pricePerSession':
    case 'teacherPayPerSession':
    case 'teacherPayPerStudent':
      return formatCurrencyForHistory(value);
    case 'baseDuration':
    case 'sessionDuration':
      return `${toSafeNumber(value, 0)} phut`;
    case 'maxStudents':
      return `${toSafeNumber(value, 0)}`;
    default:
      return String(value);
  }
}

// ══════════════════════════════════════════════════════════════════
// FILTERING
// ══════════════════════════════════════════════════════════════════

export function filterClassStudentsByIds(classroom: any, allowedStudentIds: Set<string>) {
  if (!classroom || !Array.isArray(classroom.students)) {
    return classroom;
  }

  const filteredStudents = classroom.students.filter((student: any) => {
    const studentId = student?._id?.toString?.() ?? student?.toString?.();
    return !!studentId && allowedStudentIds.has(studentId);
  });

  return {
    ...classroom,
    students: filteredStudents,
    studentConfigs: Array.isArray(classroom.studentConfigs)
      ? classroom.studentConfigs.filter((config: any) => {
          const studentId = config?.studentId?._id?.toString?.() || config?.studentId?.toString?.();
          return !!studentId && allowedStudentIds.has(studentId);
        })
      : [],
  };
}

export function getPendingOfflineAssignmentStudentIds(
  classroom: any,
  status = OfflineAssignmentRequestStatus.PENDING,
): string[] {
  const requests = Array.isArray(classroom?.pendingOfflineAssignments)
    ? classroom.pendingOfflineAssignments
    : [];
  const studentIds = new Set<string>();
  for (const request of requests) {
    if (request?.status !== status) {
      continue;
    }
    const requestStudentIds = Array.isArray(request?.studentIds) ? request.studentIds : [];
    for (const studentId of requestStudentIds) {
      const normalizedStudentId = objectIdToString(studentId);
      if (normalizedStudentId) {
        studentIds.add(normalizedStudentId);
      }
    }
  }
  return Array.from(studentIds);
}

export function countReservedOfflineStudents(classroom: any): number {
  const reservedStudentIds = new Set<string>();
  const currentStudents = Array.isArray(classroom?.students) ? classroom.students : [];
  for (const student of currentStudents) {
    const studentId = objectIdToString(student);
    if (studentId) {
      reservedStudentIds.add(studentId);
    }
  }
  for (const studentId of getPendingOfflineAssignmentStudentIds(classroom)) {
    reservedStudentIds.add(studentId);
  }
  return reservedStudentIds.size;
}

// ══════════════════════════════════════════════════════════════════
// AUTHORIZATION CHECKS
// ══════════════════════════════════════════════════════════════════

export function assertCanReviewPendingUpdate(pendingSaleUpdate: any, actor?: JwtPayload): void {
  if (!actor || !isManagerRole(actor.role)) {
    throw new ForbiddenException('Ban khong co quyen duyet thay doi lop hoc');
  }

  if (pendingSaleUpdate?.status && pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
    throw new BadRequestException('Yeu cau sua lop hoc khong con cho duyet');
  }
}

export function assertCanReviewPendingOfflineAssignment(actor?: JwtPayload): void {
  if (!actor || !isManagerRole(actor.role)) {
    throw new ForbiddenException('Ban khong co quyen duyet yeu cau them hoc sinh offline');
  }
}

// ══════════════════════════════════════════════════════════════════
// ORDER ITEM / INVOICE PRICING
// ══════════════════════════════════════════════════════════════════

export function getOrderItemForInvoice(order: any | null, invoice: any | null): any | null {
  if (!order || !Array.isArray(order.items) || !order.items.length || !invoice) {
    return null;
  }

  const itemIndex = Number(invoice.orderItemIndex);
  if (Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < order.items.length) {
    return order.items[itemIndex] || null;
  }

  const invoiceNumber = String(invoice.invoiceNumber || '').trim().toUpperCase();
  if (invoiceNumber) {
    const matchedByNumber = order.items.find(
      (item: any) => String(item?.invoiceNumber || '').trim().toUpperCase() === invoiceNumber,
    );
    if (matchedByNumber) {
      return matchedByNumber;
    }
  }

  const productId = objectIdToString(invoice.productId);
  if (productId) {
    const matchedByProduct = order.items.filter(
      (item: any) => objectIdToString(item?.productId) === productId,
    );
    if (matchedByProduct.length === 1) {
      return matchedByProduct[0];
    }
  }

  return order.items[0] || null;
}

export function buildInvoicePricingContext(invoice: any | null, orderItem?: any | null): any | null {
  if (!invoice) {
    return null;
  }

  const orderItemPricePerSession = roundMoneyToThousand(
    toSafeNumber(orderItem?.pricePerSession, 0),
  );
  const orderItemReferenceDuration = pickFirstPositiveNumber(
    orderItem?.baseDuration,
    orderItem?.sessionDuration,
  );
  const orderItemTeacherPayPerSession = roundMoneyDownToThousand(
    toSafeNumber(orderItem?.teacherPayPerSession, 0),
  );
  const orderItemTeacherPayPerStudent = roundMoneyDownToThousand(
    toSafeNumber(orderItem?.teacherPayPerStudent, 0),
  );

  return {
    ...invoice,
    pricePerSession: roundMoneyToThousand(
      pickFirstPositiveNumber(invoice?.pricePerSession, orderItemPricePerSession),
    ),
    referenceDuration:
      pickFirstPositiveNumber(
        invoice?.referenceDuration,
        orderItemReferenceDuration,
        60,
      ) || 60,
    teacherPayPerSession: roundMoneyDownToThousand(
      pickFirstPositiveNumber(
        invoice?.teacherPayPerSession,
        orderItemTeacherPayPerSession,
      ),
    ),
    teacherPayPerStudent: roundMoneyDownToThousand(
      pickFirstPositiveNumber(
        (invoice as any)?.teacherPayPerStudent,
        orderItemTeacherPayPerStudent,
      ),
    ),
  };
}

// ══════════════════════════════════════════════════════════════════
// DURATION / PRICING SNAPSHOT BUILDERS
// ══════════════════════════════════════════════════════════════════

export function buildDurationSnapshotData(classState: any): {
  baseDuration: number;
  sessionDuration: number;
  pricePerSession: number;
  teacherPayPerSession: number;
  teacherPayPerStudent: number;
};
export function buildDurationSnapshotData(
  classState: any,
  options: {
    preferPendingValues?: boolean;
  },
): {
  baseDuration: number;
  sessionDuration: number;
  pricePerSession: number;
  teacherPayPerSession: number;
  teacherPayPerStudent: number;
};
export function buildDurationSnapshotData(
  classState: any,
  options?: {
    preferPendingValues?: boolean;
  },
): {
  baseDuration: number;
  sessionDuration: number;
  pricePerSession: number;
  teacherPayPerSession: number;
  teacherPayPerStudent: number;
} {
  const classPricing = getClassPricingConfigAt(classState);
  const snapshot = classState?.pricingSnapshot || {};
  const preferPendingValues = options?.preferPendingValues === true;
  const baseDuration =
    pickFirstPositiveNumber(
      ...(preferPendingValues
        ? [
            classState?.baseDuration,
            classPricing.baseDuration,
            snapshot.referenceDuration,
          ]
        : [
            classPricing.baseDuration,
            snapshot.referenceDuration,
            classState?.baseDuration,
          ]),
      60,
    ) || 60;
  const sessionDuration =
    pickFirstPositiveNumber(
      ...(preferPendingValues
        ? [
            classState?.sessionDuration,
            classPricing.sessionDuration,
            snapshot.sessionDuration,
          ]
        : [
            classPricing.sessionDuration,
            snapshot.sessionDuration,
            classState?.sessionDuration,
          ]),
      baseDuration,
    )
    || baseDuration;

  return {
    baseDuration,
    sessionDuration,
    pricePerSession: roundMoneyToThousand(pickFirstPositiveNumber(
      ...(preferPendingValues
        ? [
            classState?.pricePerSession,
            classPricing.pricePerSession,
            snapshot.pricePerSession,
          ]
        : [
            classPricing.pricePerSession,
            snapshot.pricePerSession,
            classState?.pricePerSession,
          ]),
    )),
    teacherPayPerSession: roundMoneyDownToThousand(pickFirstPositiveNumber(
      ...(preferPendingValues
        ? [
            classState?.teacherPayPerSession,
            classPricing.teacherPayPerSession,
            snapshot.teacherPayPerSession,
          ]
        : [
            classPricing.teacherPayPerSession,
            snapshot.teacherPayPerSession,
            classState?.teacherPayPerSession,
          ]),
    )),
    teacherPayPerStudent: roundMoneyDownToThousand(pickFirstPositiveNumber(
      ...(preferPendingValues
        ? [
            classState?.teacherPayPerStudent,
            classPricing.teacherPayPerStudent,
            snapshot.teacherPayPerStudent,
          ]
        : [
            classPricing.teacherPayPerStudent,
            snapshot.teacherPayPerStudent,
            classState?.teacherPayPerStudent,
          ]),
    )),
  };
}

export function buildDurationSnapshotRecord(
  classState: any,
  source: DurationSnapshotSource,
  requestType: PendingClassUpdateType,
  effectiveById?: string | null,
) {
  return {
    source,
    requestType,
    effectiveAt: new Date(),
    effectiveBy: effectiveById ? new Types.ObjectId(effectiveById) : undefined,
    ...buildDurationSnapshotData(classState),
  };
}

export function buildInitialStudentConfigRecord(
  classState: any,
  studentId: string,
  totalSessions: number,
  actorId?: string | null,
) {
  if (!classState?.teacher) {
    throw new BadRequestException('Lop hoc chua co giao vien phu trach');
  }

  const durationSnapshot = buildDurationSnapshotData(classState);
  return {
    studentId: new Types.ObjectId(studentId),
    teacherSlots: [
      {
        slotIndex: 1,
        slotType: StudentConfigSlotType.INITIAL,
        teacherId: new Types.ObjectId(classState.teacher.toString()),
        assignedAt: new Date(),
        assignedBy: actorId ? new Types.ObjectId(actorId) : undefined,
      },
    ],
    durationSlots: [
      {
        slotIndex: 1,
        slotType: StudentConfigSlotType.INITIAL,
        effectiveAt: new Date(),
        effectiveBy: actorId ? new Types.ObjectId(actorId) : undefined,
        baseDuration: durationSnapshot.baseDuration,
        sessionDuration: durationSnapshot.sessionDuration,
        totalSessions: floorSessionCount(totalSessions),
      },
    ],
    updatedAt: new Date(),
  };
}

// ══════════════════════════════════════════════════════════════════
// CLASS PRICING / FINANCIAL DISPLAY
// ══════════════════════════════════════════════════════════════════

export function resolveCurrentClassPricingState(classroom: any, sourceInvoice?: any | null): {
  baseDuration: number;
  sessionDuration: number;
  pricePerSession: number;
  teacherPayPerSession: number;
  teacherPayPerStudent: number;
} {
  const classPricing = getClassPricingConfigAt(classroom);
  const pricingSnapshot = classroom?.pricingSnapshot || {};
  const baseDuration = pickFirstPositiveNumber(
    classPricing.baseDuration,
    pricingSnapshot.referenceDuration,
    sourceInvoice?.referenceDuration,
    classroom?.baseDuration,
    60,
  ) || 60;
  const sessionDuration = pickFirstPositiveNumber(
    classPricing.sessionDuration,
    pricingSnapshot.sessionDuration,
    classroom?.sessionDuration,
    baseDuration,
  ) || baseDuration;
  const pricePerSession = roundMoneyToThousand(pickFirstPositiveNumber(
    classPricing.pricePerSession,
    pricingSnapshot.pricePerSession,
    sourceInvoice?.pricePerSession,
    classroom?.pricePerSession,
    classroom?.revenuePerStudent,
  ));
  const teacherPayPerSession = roundMoneyDownToThousand(pickFirstPositiveNumber(
    classPricing.teacherPayPerSession,
    pricingSnapshot.teacherPayPerSession,
    sourceInvoice?.teacherPayPerSession,
    classroom?.teacherPayPerSession,
    classroom?.teacherSalaryCost,
  ));
  const teacherPayPerStudent = roundMoneyDownToThousand(pickFirstPositiveNumber(
    classPricing.teacherPayPerStudent,
    pricingSnapshot.teacherPayPerStudent,
    sourceInvoice?.teacherPayPerStudent,
    classroom?.teacherPayPerStudent,
  ));

  return {
    baseDuration,
    sessionDuration,
    pricePerSession,
    teacherPayPerSession,
    teacherPayPerStudent,
  };
}

export function buildClassFinancialSummary(classroom: any, sourceInvoice?: any | null): {
  actualPricePerSession: number;
  actualTeacherPayPerSession: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  studentCount: number;
} {
  const studentCount = classroom.students?.length || 0;
  const currentPricing = resolveCurrentClassPricingState(classroom, sourceInvoice);
  const baseDur = currentPricing.baseDuration;
  const sessDur = currentPricing.sessionDuration;
  const ratio = sessDur / baseDur;
  const actualPricePerSession = roundMoneyToThousand(currentPricing.pricePerSession * ratio);
  const actualTeacherPayPerSession = roundMoneyDownToThousand(
    currentPricing.teacherPayPerSession * ratio,
  );
  const isOffline = classroom.classMode === 'OFFLINE';
  const totalRevenue = actualPricePerSession * studentCount;
  const totalCost = isOffline
    ? roundMoneyDownToThousand(currentPricing.teacherPayPerStudent * studentCount)
    : actualTeacherPayPerSession;
  const profit = totalRevenue - totalCost;

  return {
    actualPricePerSession,
    actualTeacherPayPerSession,
    totalRevenue,
    totalCost,
    profit,
    studentCount,
  };
}

export function decorateClassroomForDisplay(classroom: any, sourceInvoice?: any | null) {
  const resolvedPricing = resolveCurrentClassPricingState(classroom, sourceInvoice);
  return {
    ...classroom,
    ...resolvedPricing,
    ...buildClassFinancialSummary(
      {
        ...classroom,
        ...resolvedPricing,
      },
      sourceInvoice,
    ),
  };
}

export function applyInvoicePricingDefaults(payload: Record<string, unknown>, invoice: any | null): void {
  if (!invoice) return;

  const invoiceReferenceDuration = toSafeNumber(invoice.referenceDuration, 60);
  const invoicePricePerSession = roundMoneyToThousand(
    toSafeNumber(invoice.pricePerSession, 0),
  );

  if (payload.baseDuration === undefined && invoiceReferenceDuration > 0) {
    payload.baseDuration = invoiceReferenceDuration;
  }

  if (payload.pricePerSession === undefined && invoicePricePerSession > 0) {
    payload.pricePerSession = invoicePricePerSession;
  }

  const invoiceTeacherPayPerSession = roundMoneyDownToThousand(
    toSafeNumber(invoice.teacherPayPerSession, 0),
  );
  if (payload.teacherPayPerSession === undefined && invoiceTeacherPayPerSession > 0) {
    payload.teacherPayPerSession = invoiceTeacherPayPerSession;
  }

  const invoiceTeacherPayPerStudent = roundMoneyDownToThousand(
    toSafeNumber(invoice.teacherPayPerStudent, 0),
  );
  if (payload.teacherPayPerStudent === undefined && invoiceTeacherPayPerStudent > 0) {
    payload.teacherPayPerStudent = invoiceTeacherPayPerStudent;
  }
}

export function attachPricingSnapshot(payload: Record<string, unknown>, invoice: any | null): void {
  const referenceDuration = toSafeNumber(payload.baseDuration, 60) || 60;
  const sessionDuration =
    toSafeNumber(payload.sessionDuration, referenceDuration) || referenceDuration;
  const pricePerSession = roundMoneyToThousand(toSafeNumber(payload.pricePerSession, 0));
  const teacherPayPerSession = roundMoneyDownToThousand(
    toSafeNumber(payload.teacherPayPerSession, 0),
  );
  const teacherPayPerStudent = roundMoneyDownToThousand(
    toSafeNumber(payload.teacherPayPerStudent, 0),
  );

  let perMinuteRate = toSafeNumber(invoice?.perMinuteRate, 0);
  if (perMinuteRate <= 0 && pricePerSession > 0 && referenceDuration > 0) {
    perMinuteRate = pricePerSession / referenceDuration;
  }

  payload.pricingSnapshot = {
    source: invoice ? PricingSnapshotSource.INVOICE : PricingSnapshotSource.MANUAL,
    capturedAt: new Date(),
    sourceInvoiceId: invoice?._id ? new Types.ObjectId(invoice._id) : undefined,
    sourceInvoiceNumber: invoice?.invoiceNumber,
    referenceDuration,
    sessionDuration,
    pricePerSession,
    perMinuteRate,
    teacherPayPerSession,
    teacherPayPerStudent,
  };
}

// ══════════════════════════════════════════════════════════════════
// SALE UPDATE SPLITTING
// ══════════════════════════════════════════════════════════════════

export function splitSaleUpdateChanges(
  dto: UpdateClassDto,
  existing: any,
): {
  directChanges: UpdateClassDto;
  approvalChanges: UpdateClassDto | null;
  requestType: PendingClassUpdateType | null;
} {
  const saleChanges = sanitizeSaleUpdateDto(dto);
  const directChanges = new UpdateClassDto();
  const approvalChanges = new UpdateClassDto();

  const directFieldNames: Array<keyof UpdateClassDto> = [
    'name',
    'productPackageId',
    'subject',
    'grade',
    'learningGoals',
    'curriculum',
    'revenuePerStudent',
    'teacherSalaryCost',
    'maxStudents',
  ];

  for (const fieldName of directFieldNames) {
    if (saleChanges[fieldName] !== undefined) {
      directChanges[fieldName] = saleChanges[fieldName] as never;
    }
  }

  if (
    saleChanges.pricePerSession !== undefined
    && toSafeNumber(saleChanges.pricePerSession, 0)
      !== toSafeNumber(existing?.pricePerSession, 0)
  ) {
    approvalChanges.pricePerSession = saleChanges.pricePerSession;
  }

  if (
    saleChanges.teacherId !== undefined
    && !isSameObjectId(saleChanges.teacherId, existing?.teacher)
  ) {
    approvalChanges.teacherId = saleChanges.teacherId;
  }

  if (
    saleChanges.teacherPayPerSession !== undefined
    && toSafeNumber(saleChanges.teacherPayPerSession, 0)
      !== toSafeNumber(existing?.teacherPayPerSession, 0)
  ) {
    approvalChanges.teacherPayPerSession = saleChanges.teacherPayPerSession;
  }

  if (
    saleChanges.teacherPayPerStudent !== undefined
    && toSafeNumber(saleChanges.teacherPayPerStudent, 0)
      !== toSafeNumber(existing?.teacherPayPerStudent, 0)
  ) {
    approvalChanges.teacherPayPerStudent = saleChanges.teacherPayPerStudent;
  }

  if (
    saleChanges.baseDuration !== undefined
    && toSafeNumber(saleChanges.baseDuration, 0)
      !== toSafeNumber(existing?.baseDuration, 0)
  ) {
    approvalChanges.baseDuration = saleChanges.baseDuration;
  }

  if (
    saleChanges.sessionDuration !== undefined
    && toSafeNumber(saleChanges.sessionDuration, 0)
      !== toSafeNumber(existing?.sessionDuration, 0)
  ) {
    approvalChanges.sessionDuration = saleChanges.sessionDuration;
  }

  const hasApprovalChanges = Object.keys(approvalChanges).length > 0;
  const requestType = hasApprovalChanges
    ? resolveRequestedUpdateType(dto)
    : null;

  if (requestType) {
    approvalChanges.requestType = requestType;
  }

  return {
    directChanges,
    approvalChanges: hasApprovalChanges ? approvalChanges : null,
    requestType,
  };
}

// ══════════════════════════════════════════════════════════════════
// SOURCE INVOICE LOOKUP (pure)
// ══════════════════════════════════════════════════════════════════

export function getClassSourceInvoice(classroom: any, invoiceMap: Map<string, any>): any | null {
  const linkedInvoiceIds = [
    objectIdToString(classroom?.invoiceId),
    objectIdToString(classroom?.pricingSnapshot?.sourceInvoiceId),
  ].filter((invoiceId): invoiceId is string => !!invoiceId);

  for (const invoiceId of linkedInvoiceIds) {
    const invoice = invoiceMap.get(invoiceId);
    if (invoice) {
      return invoice;
    }
  }

  return null;
}
