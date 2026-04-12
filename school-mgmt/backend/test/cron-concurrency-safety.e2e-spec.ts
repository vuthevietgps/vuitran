import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module';
import { SessionCronService } from '../src/sessions/session-cron.service';
import { ReconciliationService } from '../src/tasks/reconciliation.service';
import { WalletsQueryService } from '../src/wallets/wallets-query.service';
import { closeE2eResources } from './e2e-cleanup';

import {
  SessionStatus,
  SessionType,
} from '../src/sessions/schemas/session.schema';
import {
  WalletStatus,
} from '../src/wallets/schemas/wallet.schema';
import {
  TransactionStatus,
  TransactionType,
} from '../src/wallets/schemas/ledger-entry.schema';

jest.setTimeout(180_000);

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: string;
};

describe('Cron concurrency safety (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let classModel: Model<any>;
  let studentModel: Model<any>;
  let sessionModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerModel: Model<any>;
  let payrollTxModel: Model<any>;

  let sessionCronService: SessionCronService;
  let reconciliationService: ReconciliationService;
  let walletsQueryService: WalletsQueryService;

  const teacher: SeedUser = {
    email: 'teacher.cron-concurrency.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Cron Concurrency',
    role: 'TEACHER',
  };

  const parent: SeedUser = {
    email: 'parent.cron-concurrency.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent Cron Concurrency',
    role: 'PARENT',
  };

  const director: SeedUser = {
    email: 'director.cron-concurrency.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Cron Concurrency',
    role: 'DIRECTOR',
  };

  const accounting: SeedUser = {
    email: 'accounting.cron-concurrency.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting Cron Concurrency',
    role: 'ACCOUNTING',
  };

  const seedLessonContent =
    'Buoi hoc duoc chuan bi day du noi dung, co ban giang, bai tap va nhan xet can thiet.';

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashedPassword,
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return userModel.findOne({ email: user.email }).lean();
  }

  function ensureObjectId(value: string | Types.ObjectId): Types.ObjectId {
    return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    const uri = replSet.getUri();
    process.env.MONGODB_URI = uri.replace('?', 'cron-concurrency-e2e?');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    userModel = moduleRef.get(getModelToken('User'));
    classModel = moduleRef.get(getModelToken('Classroom'));
    studentModel = moduleRef.get(getModelToken('Student'));
    sessionModel = moduleRef.get(getModelToken('Session'));
    walletModel = moduleRef.get(getModelToken('Wallet'));
    ledgerModel = moduleRef.get(getModelToken('LedgerEntry'));
    payrollTxModel = moduleRef.get(getModelToken('PayrollTransaction'));

    sessionCronService = moduleRef.get(SessionCronService, { strict: false });
    reconciliationService = moduleRef.get(ReconciliationService, { strict: false });
    walletsQueryService = moduleRef.get(WalletsQueryService, { strict: false });

    const [teacherUser, parentUser, directorUser, accountingUser] = await Promise.all([
      upsertUser(teacher),
      upsertUser(parent),
      upsertUser(director),
      upsertUser(accounting),
    ]);

    const teacherId = ensureObjectId(teacherUser._id);
    const parentId = ensureObjectId(parentUser._id);
    const directorId = ensureObjectId(directorUser._id);
    const accountingId = ensureObjectId(accountingUser._id);

    const classroom = await classModel.create({
      name: 'Cron Concurrency Class',
      code: 'CRON-CONC-001',
      teacher: teacherId,
      sale: directorId,
      classMode: 'ONLINE',
      pricePerSession: 150000,
      teacherPayPerSession: 120000,
      teacherPayPerStudent: 120000,
      baseDuration: 60,
      sessionDuration: 60,
      status: 'ACTIVE',
      students: [],
    });

    const student = await studentModel.create({
      studentCode: 'ST-CRON-001',
      fullName: 'Student Cron Concurrency',
      age: 10,
      parentUserId: parentId,
      parentName: 'Parent Cron Concurrency',
      parentPhone: '0900000001',
      faceImage: 'https://example.com/face-cron-concurrency.jpg',
      saleId: directorId,
      classId: classroom._id,
      approvalStatus: 'APPROVED',
    });

    await classModel.updateOne(
      { _id: classroom._id },
      { $addToSet: { students: student._id } },
    );

    const parentWallet = await walletModel.create({
      userId: parentId,
      balance: 1_000_000,
      debtLimit: 0,
      trialDebtSessions: 2,
      totalTopUp: 1_000_000,
      totalDeducted: 0,
      totalRefunded: 0,
      totalTransferOut: 0,
      totalTransferIn: 0,
      status: WalletStatus.ACTIVE,
      lastTransactionAt: new Date(),
    });

    await ledgerModel.create({
      walletId: parentWallet._id,
      userId: parentId,
      type: TransactionType.TOP_UP,
      status: TransactionStatus.COMPLETED,
      amount: 1_000_000,
      balanceBefore: 0,
      balanceAfter: 1_000_000,
      description: 'Initial funding for cron concurrency test',
      createdBy: accountingId,
      approvedBy: accountingId,
      approvedAt: new Date(),
    });

    const mismatchWallet = await walletModel.create({
      userId: accountingId,
      balance: 250_000,
      debtLimit: 0,
      trialDebtSessions: 2,
      totalTopUp: 250_000,
      totalDeducted: 0,
      totalRefunded: 0,
      totalTransferOut: 0,
      totalTransferIn: 0,
      status: WalletStatus.ACTIVE,
      lastTransactionAt: new Date(),
    });

    await ledgerModel.create({
      walletId: mismatchWallet._id,
      userId: accountingId,
      type: TransactionType.TOP_UP,
      status: TransactionStatus.COMPLETED,
      amount: 250_000,
      balanceBefore: 0,
      balanceAfter: 400_000,
      description: 'Intentional mismatch for verification test',
      createdBy: directorId,
      approvedBy: directorId,
      approvedAt: new Date(),
    });

    const now = Date.now();
    const sessions = Array.from({ length: 4 }, (_, index) => {
      const scheduledDate = new Date(now - (index + 5) * 60 * 60 * 1000);
      const teacherCompletedAt = new Date(now - (index + 3) * 60 * 60 * 1000);
      const reportSubmittedAt = new Date(teacherCompletedAt.getTime() + 15 * 60 * 1000);
      const reportDeadline = new Date(teacherCompletedAt.getTime() + 60 * 60 * 1000);

      return {
        classId: classroom._id,
        studentId: student._id,
        teacherId,
        parentUserId: parentId,
        scheduledDate,
        durationMinutes: 60,
        status: SessionStatus.TEACHER_COMPLETED,
        sessionType: SessionType.REGULAR,
        hasTeachingReport: true,
        teachingReport: {
          lessonContent: `${seedLessonContent} Session ${index + 1}.`,
          submittedAt: reportSubmittedAt,
          deadline: reportDeadline,
          isLateSubmission: false,
          lateSubmissionHours: 0,
          version: 1,
          lastUpdatedAt: reportSubmittedAt,
          recordingFileKey: `recordings/cron-concurrency/session-${index + 1}.mp4`,
        },
        confirmation: {
          teacherCompletedAt,
        },
        autoConfirmAfterHours: 1,
        amountCharged: 150_000,
        referenceAmountCharged: 150_000,
        teacherPayout: 120_000,
        isPaid: false,
        isBonusSession: false,
        invoiceConsumptionApplied: false,
        trialConverted: false,
      };
    });

    await sessionModel.insertMany(sessions.map((session) => ({
      ...session,
      scheduledDate: session.scheduledDate,
      confirmation: session.confirmation,
      teachingReport: session.teachingReport,
    })));
  }, 120_000);

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  it('runs reconciliation, auto-confirm and wallet verification concurrently without rejection', async () => {
    const sessionWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sessionWindowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [reconciliationResult, autoConfirmResult, verificationResult] = await Promise.all([
      reconciliationService.runManual(sessionWindowStart, sessionWindowEnd),
      sessionCronService.autoConfirmSessions(),
      walletsQueryService.runManualLedgerVerification(),
    ]);

    expect(reconciliationResult.sessionsScanned).toBeGreaterThanOrEqual(4);
    expect(reconciliationResult.missingTxCreated).toBeGreaterThanOrEqual(4);
    expect(reconciliationResult.criticalAnomalies).toBe(0);

    expect(autoConfirmResult).toBeUndefined();

    expect(verificationResult.checked).toBe(2);
    expect(verificationResult.discrepancies).toBe(1);
    expect(verificationResult.issues).toHaveLength(1);

    const sessionIds = await sessionModel.find({}).select('_id').lean();
    const finalizedCount = await sessionModel.countDocuments({
      _id: { $in: sessionIds.map((doc: any) => doc._id) },
      status: SessionStatus.FINALIZED,
    });
    expect(finalizedCount).toBe(4);

    const payrollCount = await payrollTxModel.countDocuments({});
    expect(payrollCount).toBe(4);

    const parentWallet = (await walletModel
      .findOne({ status: WalletStatus.ACTIVE })
      .sort({ createdAt: 1 })
      .lean()) as any;
    expect(parentWallet?.balance).toBeLessThan(1_000_000);
  });
});
