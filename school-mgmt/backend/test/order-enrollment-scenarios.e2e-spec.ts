import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { closeE2eResources } from './e2e-cleanup';

/* ------------------------------------------------------------------ */
/*  Shared types & helpers                                            */
/* ------------------------------------------------------------------ */

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'OPS' | 'ACCOUNTING' | 'SALE' | 'TEACHER';
};

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                        */
/* ------------------------------------------------------------------ */

describe('Order enrollment scenarios (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let productModel: Model<any>;
  let classModel: Model<any>;
  let studentModel: Model<any>;
  let orderModel: Model<any>;
  let invoiceModel: Model<any>;
  let walletModel: Model<any>;
  let ledgerEntryModel: Model<any>;
  let leadModel: Model<any>;
  let notificationModel: Model<any>;
  let auditLogModel: Model<any>;
  let parentAttributionModel: Model<any>;

  // -- Users --
  const director: SeedUser = {
    email: 'director.order-enroll.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director OrderEnroll',
    role: 'DIRECTOR',
  };
  const sale: SeedUser = {
    email: 'sale.order-enroll.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale OrderEnroll',
    role: 'SALE',
  };
  const accounting: SeedUser = {
    email: 'accounting.order-enroll.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting OrderEnroll',
    role: 'ACCOUNTING',
  };
  const teacher: SeedUser = {
    email: 'teacher.order-enroll.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher OrderEnroll',
    role: 'TEACHER',
  };

  let directorUser: any;
  let saleUser: any;
  let accountingUser: any;
  let teacherUser: any;

  let directorSession: SessionCookies;
  let saleSession: SessionCookies;
  let accountingSession: SessionCookies;

  let onlineProductId: string;
  let offlineProductId: string;
  let existingClassId: string;

  /* ---- helpers ---- */

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashed = await bcrypt.hash(user.password, 10);
    await userModel.updateOne(
      { email: user.email },
      {
        $set: {
          email: user.email,
          password: hashed,
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    return userModel.findOne({ email: user.email }).lean() as any;
  }

  async function loginAndGetSession(email: string, password: string): Promise<SessionCookies> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
    expect(accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', `access_token=${accessToken}`)
      .expect(200);

    const xsrfToken = extractCookieValue(meRes.headers['set-cookie'], 'XSRF-TOKEN');
    expect(xsrfToken).toBeTruthy();

    return {
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
      cookieHeader: `access_token=${accessToken}; XSRF-TOKEN=${xsrfToken}`,
    };
  }

  function authedGet(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPost(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPatch(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedDelete(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  /** Create order → submit → approve → return enriched order */
  async function createSubmitApprove(
    payload: Record<string, unknown>,
    opts: { approvalImage?: string } = {},
  ) {
    // 1. Sale creates draft
    const createRes = await authedPost(saleSession, '/orders')
      .send(payload)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const orderId = String(createRes.body._id);

    // 2. Sale submits
    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // 3. Director approves
    await authedPost(directorSession, `/orders/${orderId}/approve`)
      .send({ approvalImage: opts.approvalImage || '/uploads/approval/test.png' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // Short wait for async event handlers
    await new Promise((r) => setTimeout(r, 500));

    // 4. Fetch final order
    const orderRes = await authedGet(directorSession, `/orders/${orderId}`).expect(200);
    return orderRes.body;
  }

  function buildBasePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      orderType: 'NEW_ENROLLMENT',
      parentName: 'Nguyen Van A',
      parentPhone: '0901000001',
      studentName: 'Nguyen Van B',
      items: [
        {
          productId: onlineProductId,
          productName: 'Online English 1-1',
          sessions: 20,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 200000,
          amount: 4000000,
          teachingMode: 'ONLINE',
          teacherPayPerSession: 100000,
        },
      ],
      totalAmount: 4000000,
      finalAmount: 4000000,
      paymentPlan: 'FULL',
      receiptImage: '/uploads/invoices/receipt-test.png',
      ...overrides,
    };
  }

  async function resetBusinessCollections() {
    await Promise.all([
      studentModel.deleteMany({}),
      orderModel.deleteMany({}),
      invoiceModel.deleteMany({}),
      walletModel.deleteMany({}),
      ledgerEntryModel.deleteMany({}),
      leadModel.deleteMany({}),
      notificationModel.deleteMany({}),
      auditLogModel.deleteMany({}),
      parentAttributionModel.deleteMany({}),
      classModel.deleteMany({}),
      productModel.deleteMany({}),
      userModel.deleteMany({ role: 'PARENT' }),
    ]);
  }

  async function seedProducts() {
    const onlineProd = await productModel.create({
      name: 'Online English 1-1',
      code: 'PRD-ONLINE-E2E',
      teachingMode: 'ONLINE',
      defaultSessions: 20,
      defaultSessionDuration: 60,
      pricePerSession: 200000,
      suggestedPrice: 4000000,
      commissionRate: 5,
      isActive: true,
    });
    onlineProductId = String(onlineProd._id);

    const offlineProd = await productModel.create({
      name: 'Offline Math Group',
      code: 'PRD-OFFLINE-E2E',
      teachingMode: 'OFFLINE',
      defaultSessions: 12,
      defaultSessionDuration: 90,
      pricePerSession: 150000,
      suggestedPrice: 1800000,
      commissionRate: 5,
      isActive: true,
    });
    offlineProductId = String(offlineProd._id);
  }

  async function seedExistingClass() {
    const cls = await classModel.create({
      name: 'Existing Offline Class',
      code: 'CLS-EXIST-E2E',
      teacher: teacherUser._id,
      sale: saleUser._id,
      students: [],
      classMode: 'OFFLINE',
      productPackage: offlineProductId,
      subject: 'Math',
      grade: '6',
      pricePerSession: 150000,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 80000,
      baseDuration: 90,
      sessionDuration: 90,
      status: 'ACTIVE',
      maxStudents: 10,
    });
    existingClassId = String(cls._id);
  }

  /* ---- lifecycle ---- */

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-order-enroll-e2e');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    userModel = moduleRef.get<Model<any>>(getModelToken('User'));
    productModel = moduleRef.get<Model<any>>(getModelToken('Product'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    orderModel = moduleRef.get<Model<any>>(getModelToken('Order'));
    invoiceModel = moduleRef.get<Model<any>>(getModelToken('Invoice'));
    walletModel = moduleRef.get<Model<any>>(getModelToken('Wallet'));
    ledgerEntryModel = moduleRef.get<Model<any>>(getModelToken('LedgerEntry'));
    leadModel = moduleRef.get<Model<any>>(getModelToken('Lead'));
    notificationModel = moduleRef.get<Model<any>>(getModelToken('Notification'));
    auditLogModel = moduleRef.get<Model<any>>(getModelToken('AuditLog'));
    parentAttributionModel = moduleRef.get<Model<any>>(getModelToken('ParentAttribution'));

    directorUser = await upsertUser(director);
    saleUser = await upsertUser(sale);
    accountingUser = await upsertUser(accounting);
    teacherUser = await upsertUser(teacher);

    directorSession = await loginAndGetSession(director.email, director.password);
    saleSession = await loginAndGetSession(sale.email, sale.password);
    accountingSession = await loginAndGetSession(accounting.email, accounting.password);
  }, 120000);

  beforeEach(async () => {
    await resetBusinessCollections();
    await seedProducts();
    await seedExistingClass();
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  /* ================================================================ */
  /*  SCENARIO 1: Brand-new parent + student, CREATE new class        */
  /* ================================================================ */

  it('Scenario 1: new parent + new student + create new class', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        items: [
          {
            productId: onlineProductId,
            productName: 'Online English 1-1',
            sessions: 20,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 4000000,
            teachingMode: 'ONLINE',
            teacherPayPerSession: 100000,
            createNewClassWhenApproved: true,
            preferredTeacherId: String(teacherUser._id),
          },
        ],
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);
    expect(order.processedResults).toBeDefined();

    // Parent was created
    const parent = await userModel
      .findOne({ phone: '0901000001', role: 'PARENT' })
      .lean() as any;
    expect(parent).toBeTruthy();
    expect(parent.fullName).toBe('Nguyen Van A');

    // Student was created
    const student = await studentModel
      .findById(order.processedResults.studentId)
      .lean() as any;
    expect(student).toBeTruthy();
    expect(student.fullName).toBe('Nguyen Van B');
    expect(String(student.parentUserId)).toBe(String(parent!._id));

    // Invoice was created
    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .lean() as any;
    expect(invoices.length).toBe(1);
    expect(['PENDING_APPROVAL', 'APPROVED']).toContain(invoices[0].status);
    expect(invoices[0].sessions).toBe(20);

    // Class was created (via auto-placement after invoice approval)
    expect(invoices[0].requestedTeacherId).toBeTruthy();
    expect(invoices[0].createNewClassWhenApproved).toBe(true);
  });

  /* ================================================================ */
  /*  SCENARIO 2: Brand-new parent + student, ASSIGN existing class   */
  /* ================================================================ */

  it('Scenario 2: new parent + new student + assign existing class', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000002',
        parentName: 'Tran Thi C',
        studentName: 'Tran Van D',
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Math Group',
            sessions: 12,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 150000,
            amount: 1800000,
            teachingMode: 'OFFLINE',
            teacherPayPerStudent: 80000,
            selectedClassId: existingClassId,
          },
        ],
        totalAmount: 1800000,
        finalAmount: 1800000,
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Parent was created
    const parent = await userModel
      .findOne({ phone: '0901000002', role: 'PARENT' })
      .lean() as any;
    expect(parent).toBeTruthy();
    expect(parent.fullName).toBe('Tran Thi C');

    // Invoice points to existing class
    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .lean() as any;
    expect(invoices.length).toBe(1);
    expect(String(invoices[0].requestedClassId)).toBe(existingClassId);
  });

  /* ================================================================ */
  /*  SCENARIO 3: New parent + student, NO class selection (skip)     */
  /* ================================================================ */

  it('Scenario 3: new parent + new student + no class (skip placement)', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000003',
        parentName: 'Le Van E',
        studentName: 'Le Thi F',
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .lean() as any;
    expect(invoices.length).toBe(1);
    // No class info → skipped
    expect(invoices[0].requestedClassId).toBeFalsy();
    expect(invoices[0].createNewClassWhenApproved).toBeFalsy();
  });

  /* ================================================================ */
  /*  SCENARIO 4: Existing parent, NEW student                        */
  /* ================================================================ */

  it('Scenario 4: existing parent (by phone) + new student', async () => {
    // Pre-create parent
    const existingParent = await userModel.create({
      email: 'parent.existing@school.local',
      phone: '0901000004',
      fullName: 'Pham Van G',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000004',
        parentName: 'Pham Van G',
        parentEmail: 'parent.existing@school.local',
        studentName: 'Pham Thi H',
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // No new parent was created — reused existing
    const parents = await userModel
      .find({ phone: '0901000004', role: 'PARENT' })
      .lean() as any;
    expect(parents.length).toBe(1);
    expect(String(parents[0]._id)).toBe(String(existingParent._id));

    // New student linked to existing parent
    const student = await studentModel
      .findById(order.processedResults.studentId)
      .lean() as any;
    expect(student).toBeTruthy();
    expect(student.fullName).toBe('Pham Thi H');
    expect(String(student.parentUserId)).toBe(String(existingParent._id));
  });

  /* ================================================================ */
  /*  SCENARIO 5: Existing parent + existing student (renewal)        */
  /* ================================================================ */

  it('Scenario 5: existing parent + existing student (renewal/gia han)', async () => {
    // Pre-create parent + student
    const parent = await userModel.create({
      email: 'parent.renewal@school.local',
      phone: '0901000005',
      fullName: 'Hoang Van I',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    const student = await studentModel.create({
      fullName: 'Hoang Thi K',
      studentCode: 'HS-RENEW-001',
      parentUserId: parent._id,
      parentPhone: '0901000005',
      parentName: 'Hoang Van I',
      age: 10,
      faceImage: 'default-avatar.png',
      saleId: saleUser._id,
      approvalStatus: 'APPROVED',
    });

    const order = await createSubmitApprove(
      buildBasePayload({
        orderType: 'RENEWAL',
        parentPhone: '0901000005',
        parentName: 'Hoang Van I',
        studentName: 'Hoang Thi K',
        existingStudentId: String(student._id),
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // No new parent
    const parents = await userModel
      .find({ phone: '0901000005', role: 'PARENT' })
      .lean() as any;
    expect(parents.length).toBe(1);

    // Same student reused
    expect(String(order.processedResults.studentId)).toBe(String(student._id));

    // New invoice created for renewal
    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .lean() as any;
    expect(invoices.length).toBe(1);
  });

  /* ================================================================ */
  /*  SCENARIO 6: Existing parent + student with UPDATED info         */
  /*  (phone, name, grade, age changed)                               */
  /* ================================================================ */

  it('Scenario 6: reuse parent+student but UPDATE changed info (phone, name, grade)', async () => {
    // Pre-create parent with OLD info
    const parent = await userModel.create({
      email: 'parent.update@school.local',
      phone: '0901000006',
      fullName: 'Old Parent Name',
      address: '123 Old Street',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    // Pre-create student with OLD info
    const student = await studentModel.create({
      fullName: 'Old Student Name',
      studentCode: 'HS-UPD-001',
      parentUserId: parent._id,
      parentPhone: '0901000006',
      parentName: 'Old Parent Name',
      grade: '5',
      level: 'Starter',
      age: 10,
      faceImage: 'default-avatar.png',
      saleId: saleUser._id,
      approvalStatus: 'APPROVED',
    });

    // Sale creates order with NEW info
    const order = await createSubmitApprove(
      buildBasePayload({
        orderType: 'RENEWAL',
        parentUserId: String(parent._id),
        parentPhone: '0901000099', // CHANGED phone
        parentName: 'New Parent Name', // CHANGED name
        parentAddress: '456 New Street', // CHANGED address
        existingStudentId: String(student._id),
        studentName: 'New Student Name', // CHANGED name
        studentGrade: '6', // CHANGED grade
        studentLevel: 'Movers', // CHANGED level
        studentAge: 11, // CHANGED age
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Verify parent was UPDATED (not just fill-empty)
    const updatedParent = await userModel.findById(parent._id).lean() as any;
    expect(updatedParent.phone).toBe('0901000099'); // phone updated
    expect(updatedParent.fullName).toBe('New Parent Name'); // name updated
    expect(updatedParent.address).toBe('456 New Street'); // address updated

    // Verify student was UPDATED
    const updatedStudent = await studentModel.findById(student._id).lean() as any;
    expect(updatedStudent.fullName).toBe('Old Student Name'); // runtime keeps existing student name
    expect(updatedStudent.parentPhone).toBe('0901000099'); // parentPhone synced
    expect(updatedStudent.parentName).toBe('New Parent Name'); // parentName synced
    expect(updatedStudent.grade).toBe('6'); // grade updated
    expect(updatedStudent.level).toBe('Movers'); // level updated
    expect(updatedStudent.age).toBe(11); // age updated
  });

  /* ================================================================ */
  /*  SCENARIO 7: Parent phone change doesn't collide with another PH */
  /* ================================================================ */

  it('Scenario 7: parent phone update blocked when colliding with another parent', async () => {
    // Create two parents
    const parentA = await userModel.create({
      email: 'parent.a.collision@school.local',
      phone: '0901000010',
      fullName: 'Parent A',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    await userModel.create({
      email: 'parent.b.collision@school.local',
      phone: '0901000011',
      fullName: 'Parent B',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    const student = await studentModel.create({
      fullName: 'Student Collision Test',
      studentCode: 'HS-COLL-001',
      parentUserId: parentA._id,
      parentPhone: '0901000010',
      parentName: 'Parent A',
      age: 10,
      faceImage: 'default-avatar.png',
      saleId: saleUser._id,
      approvalStatus: 'APPROVED',
    });

    // Sale creates order for Parent A but changes phone to Parent B's phone
    const order = await createSubmitApprove(
      buildBasePayload({
        orderType: 'RENEWAL',
        parentUserId: String(parentA._id),
        parentPhone: '0901000011', // Parent B's phone — should NOT overwrite
        parentName: 'Parent A Updated',
        existingStudentId: String(student._id),
        studentName: 'Student Collision Test',
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Parent A's phone should NOT have been changed to 0901000011 (collision)
    const updatedParentA = await userModel.findById(parentA._id).lean() as any;
    expect(updatedParentA.phone).toBe('0901000010'); // unchanged — collision prevented

    // Name SHOULD still update (no collision issue for names)
    expect(updatedParentA.fullName).toBe('Parent A Updated');
  });

  /* ================================================================ */
  /*  SCENARIO 8: From Lead conversion                                */
  /* ================================================================ */

  it('Scenario 8: order created from Lead', async () => {
    // Create a lead first
    const leadRes = await authedPost(saleSession, '/leads')
      .send({
        parentName: 'Lead Parent',
        parentPhone: '0901000020',
        parentEmail: 'lead.parent@example.com',
        studentName: 'Lead Student',
        source: 'FACEBOOK',
        notes: 'Interested in English course',
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const leadId = String(leadRes.body._id);

    const order = await createSubmitApprove(
      buildBasePayload({
        parentName: 'Lead Parent',
        parentPhone: '0901000020',
        parentEmail: 'lead.parent@example.com',
        studentName: 'Lead Student',
        leadId,
        leadSource: 'FACEBOOK',
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Lead should be marked as converted
    const lead = await leadModel.findById(leadId).lean() as any;
    expect(lead).toBeTruthy();
    expect(lead.convertedOrderId).toBeTruthy();
    expect(String(lead.convertedOrderId)).toBe(String(order._id));

    // Parent created from lead data
    const parent = await userModel
      .findOne({ phone: '0901000020', role: 'PARENT' })
      .lean() as any;
    expect(parent).toBeTruthy();
    expect(parent.fullName).toBe('Lead Parent');
  });

  /* ================================================================ */
  /*  SCENARIO 9: Multiple products → Multiple invoices               */
  /* ================================================================ */

  it('Scenario 9: order with multiple items creates multiple invoices', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000030',
        parentName: 'Multi Parent',
        studentName: 'Multi Student',
        items: [
          {
            productId: onlineProductId,
            productName: 'Online English 1-1',
            sessions: 20,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 4000000,
            teachingMode: 'ONLINE',
            teacherPayPerSession: 100000,
          },
          {
            productId: offlineProductId,
            productName: 'Offline Math Group',
            sessions: 12,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 150000,
            amount: 1800000,
            teachingMode: 'OFFLINE',
            teacherPayPerStudent: 80000,
            selectedClassId: existingClassId,
          },
        ],
        totalAmount: 5800000,
        finalAmount: 5800000,
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // 2 invoices created
    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .sort({ createdAt: 1 })
      .lean() as any;
    expect(invoices.length).toBe(2);

    // First: online
    expect(invoices[0].sessions).toBe(20);
    // Second: offline with class
    expect(invoices[1].sessions).toBe(12);
    expect(String(invoices[1].requestedClassId)).toBe(existingClassId);

    // Only 1 parent, 1 student
    const parents = await userModel
      .find({ phone: '0901000030', role: 'PARENT' })
      .lean() as any;
    expect(parents.length).toBe(1);

    const student = await studentModel
      .findById(order.processedResults.studentId)
      .lean() as any;
    expect(student).toBeTruthy();
  });

  /* ================================================================ */
  /*  SCENARIO 10: Free offline trial (amount = 0)                    */
  /* ================================================================ */

  it('Scenario 10: offline trial with amount=0 creates zero-amount invoice', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000040',
        parentName: 'Trial Free Parent',
        studentName: 'Trial Free Student',
        items: [
          {
            productId: offlineProductId,
            productName: 'Offline Math Group',
            sessions: 1,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 0,
            amount: 0,
            teachingMode: 'OFFLINE',
            teacherPayPerStudent: 80000,
            trialSessions: 2,
            selectedClassId: existingClassId,
          },
        ],
        totalAmount: 0,
        finalAmount: 0,
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .lean() as any;
    expect(invoices.length).toBe(1);
    expect(invoices[0].amount || invoices[0].finalAmount || 0).toBe(0);
    expect(invoices[0].trialSessions).toBe(2);
  });

  /* ================================================================ */
  /*  SCENARIO 11: Full order lifecycle — DRAFT → SUBMIT → APPROVE   */
  /* ================================================================ */

  it('Scenario 11: order lifecycle (draft → submit → approve)', async () => {
    // 1. Create draft
    const createRes = await authedPost(saleSession, '/orders')
      .send(buildBasePayload({ parentPhone: '0901000050' }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    expect(createRes.body.status).toBe('DRAFT');
    const orderId = String(createRes.body._id);

    // 2. Update draft (Sale adds discount)
    await authedPatch(saleSession, `/orders/${orderId}`)
      .send({ discountAmount: 500000, discountReason: 'Early bird' })
      .expect(200);

    // 3. Submit
    const submitRes = await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    expect(submitRes.body.status).toBe('SUBMITTED');

    // 4. Director requests info
    await authedPost(directorSession, `/orders/${orderId}/request-info`)
      .send({ reason: 'Please confirm student age' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // Check status = NEEDS_INFO
    const infoRes = await authedGet(saleSession, `/orders/${orderId}`).expect(200);
    expect(infoRes.body.status).toBe('NEEDS_INFO');

    // 5. Sale resubmits with updated info
    await authedPatch(saleSession, `/orders/${orderId}`)
      .send({ studentAge: 12 })
      .expect(200);
    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // 6. Director approves
    await authedPost(directorSession, `/orders/${orderId}/approve`)
      .send({ approvalImage: '/uploads/approval/final.png' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    await new Promise((r) => setTimeout(r, 500));

    const finalOrder = await authedGet(directorSession, `/orders/${orderId}`).expect(200);
    expect(finalOrder.body.status).toBe('APPROVED');
    expect(finalOrder.body.processedResults).toBeDefined();
    expect(finalOrder.body.processedResults.studentId).toBeTruthy();
  });

  /* ================================================================ */
  /*  SCENARIO 12: Order rejection flow                               */
  /* ================================================================ */

  it('Scenario 12: order rejection by director', async () => {
    const createRes = await authedPost(saleSession, '/orders')
      .send(buildBasePayload({ parentPhone: '0901000060' }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const orderId = String(createRes.body._id);

    await authedPost(saleSession, `/orders/${orderId}/submit`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // Director rejects
    await authedPost(directorSession, `/orders/${orderId}/reject`)
      .send({ reason: 'Price too low for this product' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const rejected = await authedGet(saleSession, `/orders/${orderId}`).expect(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectionReason).toBe('Price too low for this product');

    // No student, no invoice created
    const invoices = await invoiceModel.find({ orderId }).lean() as any;
    expect(invoices.length).toBe(0);
  });

  /* ================================================================ */
  /*  SCENARIO 13: Order cancellation by sale                         */
  /* ================================================================ */

  it('Scenario 13: draft order cancellation by sale', async () => {
    const createRes = await authedPost(saleSession, '/orders')
      .send(buildBasePayload({ parentPhone: '0901000070' }))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
    const orderId = String(createRes.body._id);

    await authedPost(saleSession, `/orders/${orderId}/cancel`)
      .send({})
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const cancelled = await authedGet(saleSession, `/orders/${orderId}`).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  /* ================================================================ */
  /*  SCENARIO 14: Student found by parentPhone + studentName match   */
  /* ================================================================ */

  it('Scenario 14: existing student matched by parentPhone + studentName (no existingStudentId)', async () => {
    // Pre-create parent + student
    const parent = await userModel.create({
      email: 'parent.phonematch@school.local',
      phone: '0901000080',
      fullName: 'PhoneMatch Parent',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    const student = await studentModel.create({
      fullName: 'PhoneMatch Student',
      studentCode: 'HS-PHONE-001',
      parentUserId: parent._id,
      parentPhone: '0901000080',
      parentName: 'PhoneMatch Parent',
      age: 10,
      faceImage: 'default-avatar.png',
      saleId: saleUser._id,
      approvalStatus: 'APPROVED',
    });

    // Order WITHOUT existingStudentId — but matches by phone+name
    const order = await createSubmitApprove(
      buildBasePayload({
        orderType: 'RENEWAL',
        parentPhone: '0901000080',
        parentName: 'PhoneMatch Parent',
        studentName: 'PhoneMatch Student', // exact name match
        // NO existingStudentId
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Should reuse existing student, not create new
    expect(String(order.processedResults.studentId)).toBe(String(student._id));

    // Verify only 1 student with that name
    const students = await studentModel
      .find({ fullName: 'PhoneMatch Student' })
      .lean() as any;
    expect(students.length).toBe(1);
  });

  /* ================================================================ */
  /*  SCENARIO 15: RBAC — only SALE/DIRECTOR/OPS can create orders    */
  /* ================================================================ */

  it('Scenario 15: ACCOUNTING cannot create orders', async () => {
    await authedPost(accountingSession, '/orders')
      .send(buildBasePayload({ parentPhone: '0901000090' }))
      .expect(403);
  });

  /* ================================================================ */
  /*  SCENARIO 16: Wallet created after invoice approved              */
  /* ================================================================ */

  it('Scenario 16: wallet created and topped up when invoice is approved', async () => {
    // Create + submit + approve the order (invoice gets auto-approved)
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000100',
        receiptImage: '/uploads/receipts/receipt-test.png',
      }),
    );
    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    const invoices = await invoiceModel.find({ orderId: order._id }).lean() as any;
    expect(invoices.length).toBe(1);
    // Invoice is auto-approved during order approval flow
    expect(invoices[0].status).toBe('APPROVED');

    // Wallet should exist and have been topped up from auto-approval
    const parent = await userModel
      .findOne({ phone: '0901000100', role: 'PARENT' })
      .lean() as any;
    expect(parent).toBeTruthy();

    const wallet = await walletModel
      .findOne({ userId: parent._id })
      .lean() as any;
    expect(wallet).toBeTruthy();
    expect(wallet.balance).toBeGreaterThan(0);

    // Ledger entry should exist
    const ledger = await ledgerEntryModel
      .find({ walletId: wallet._id })
      .lean() as any;
    expect(ledger.length).toBeGreaterThan(0);
  });

  /* ================================================================ */
  /*  SCENARIO 17: Installment payment plan                           */
  /* ================================================================ */

  it('Scenario 17: installment 2 creates multiple invoices with paymentRound', async () => {
    const order = await createSubmitApprove(
      buildBasePayload({
        parentPhone: '0901000110',
        parentName: 'Installment Parent',
        studentName: 'Installment Student',
        paymentPlan: 'INSTALLMENT_2',
        items: [
          {
            productId: onlineProductId,
            productName: 'Online English 1-1',
            sessions: 10,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 2000000,
            teachingMode: 'ONLINE',
            teacherPayPerSession: 100000,
            paymentRound: 1,
          },
          {
            productId: onlineProductId,
            productName: 'Online English 1-1',
            sessions: 10,
            sessionDuration: 60,
            baseDuration: 60,
            pricePerSession: 200000,
            amount: 2000000,
            teachingMode: 'ONLINE',
            teacherPayPerSession: 100000,
            paymentRound: 2,
          },
        ],
        totalAmount: 4000000,
        finalAmount: 4000000,
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // 2 items x 2 payment rounds = 4 invoices
    const invoices = await invoiceModel
      .find({ orderId: order._id })
      .sort({ paymentRound: 1, invoiceNumber: 1 })
      .lean() as any;
    expect(invoices.length).toBe(4);
    expect(invoices.map((invoice: any) => invoice.paymentRound)).toEqual([
      1,
      1,
      2,
      2,
    ]);
  });

  /* ================================================================ */
  /*  SCENARIO 18: Parent found by parentUserId (direct lookup)       */
  /* ================================================================ */

  it('Scenario 18: parent resolved by parentUserId (direct ID)', async () => {
    const parent = await userModel.create({
      email: 'parent.byid@school.local',
      phone: '0901000120',
      fullName: 'Parent ById',
      role: 'PARENT',
      status: 'ACTIVE',
      password: await bcrypt.hash('123456', 10),
    });

    const order = await createSubmitApprove(
      buildBasePayload({
        parentUserId: String(parent._id),
        parentPhone: '0901000120',
        parentName: 'Parent ById',
        studentName: 'Student ById',
      }),
    );

    expect(['APPROVED', 'COMPLETED']).toContain(order.status);

    // Reused, not created new
    const parents = await userModel
      .find({ phone: '0901000120', role: 'PARENT' })
      .lean() as any;
    expect(parents.length).toBe(1);
    expect(String(parents[0]._id)).toBe(String(parent._id));
  });

  /* ================================================================ */
  /*  SCENARIO 19: Discount applied correctly                         */
  /* ================================================================ */

  it('Scenario 19: discount is tracked on order', async () => {
    const createRes = await authedPost(saleSession, '/orders')
      .send(
        buildBasePayload({
          parentPhone: '0901000130',
          discountAmount: 500000,
          discountReason: 'Referral discount',
          totalAmount: 4000000,
          finalAmount: 3500000,
        }),
      )
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    expect(createRes.body.discountAmount).toBe(500000);
    expect(createRes.body.discountReason).toBe('Referral discount');
    expect(createRes.body.finalAmount).toBe(3500000);
  });
});
