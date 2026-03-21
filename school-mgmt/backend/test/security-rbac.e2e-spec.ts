import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'PARENT' | 'SALE' | 'TEACHER' | 'ACCOUNTING';
};

function extractCookieValue(
  setCookies: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookies) return null;
  const rows = Array.isArray(setCookies) ? setCookies : [setCookies];
  if (rows.length === 0) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  for (const row of rows) {
    const firstPart = String(row).split(';')[0];
    const match = pattern.exec(firstPart);
    if (match?.[1]) return match[1];
  }
  return null;
}

describe('Security and RBAC (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let userModel: Model<any>;
  let teacherProfileModel: Model<any>;
  let classModel: Model<any>;
  let approvedTeacherProfileId: string;
  let pendingTeacherProfileId: string;
  let saleUserId: string;
  let saleBUserId: string;
  const sessionCache = new Map<string, SessionCookies>();

  const director: SeedUser = {
    email: 'director.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director E2E',
    role: 'DIRECTOR',
  };

  const parent: SeedUser = {
    email: 'parent.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent E2E',
    role: 'PARENT',
  };

  const sale: SeedUser = {
    email: 'sale.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale E2E',
    role: 'SALE',
  };

  const saleB: SeedUser = {
    email: 'sale-b.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale B E2E',
    role: 'SALE',
  };

  const accounting: SeedUser = {
    email: 'accounting.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Accounting E2E',
    role: 'ACCOUNTING',
  };

  const approvedTeacher: SeedUser = {
    email: 'teacher-approved.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Approved E2E',
    role: 'TEACHER',
  };

  const pendingTeacher: SeedUser = {
    email: 'teacher-pending.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Pending E2E',
    role: 'TEACHER',
  };

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

  async function getPersistentSession(user: SeedUser): Promise<SessionCookies> {
    const cached = sessionCache.get(user.email);
    if (cached) {
      return cached;
    }
    const session = await loginAndGetSession(user.email, user.password);
    sessionCache.set(user.email, session);
    return session;
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('school-mgmt-e2e');

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
    teacherProfileModel = moduleRef.get<Model<any>>(getModelToken('TeacherProfile'));
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));

    const approvedTeacherUser = await upsertUser(approvedTeacher);
    const pendingTeacherUser = await upsertUser(pendingTeacher);
    await upsertUser(director);
    await upsertUser(parent);
    const saleUser = await upsertUser(sale);
    const saleBUser = await upsertUser(saleB);
    await upsertUser(accounting);
    saleUserId = String(saleUser._id);
    saleBUserId = String(saleBUser._id);

    const approvedProfile = await teacherProfileModel.create({
      userId: approvedTeacherUser._id,
      managedSales: [saleUser._id, saleBUser._id],
      subjects: ['Math'],
      grades: ['Grade 7'],
      teachingMode: 'ONLINE',
      locations: ['District 1'],
      bio: 'Approved teacher profile',
      qualifications: [],
      yearsOfExperience: 5,
      availability: [],
      pricePerSession: 450000,
      status: 'APPROVED',
      bankInfo: {
        bankName: 'Secure Bank',
        accountNumber: '123456789',
        accountHolderName: approvedTeacher.fullName,
      },
      adminNotes: 'Internal-only note',
    });
    approvedTeacherProfileId = String(approvedProfile._id);

    await classModel.create([
      {
        name: 'RBAC Sale A Class',
        code: 'RBAC-A-CLASS',
        teacher: approvedTeacherUser._id,
        sale: saleUser._id,
        students: [],
        classMode: 'ONLINE',
        pricePerSession: 450000,
        teacherPayPerSession: 250000,
        teacherPayPerStudent: 0,
      },
      {
        name: 'RBAC Sale B Class',
        code: 'RBAC-B-CLASS',
        teacher: approvedTeacherUser._id,
        sale: saleBUser._id,
        students: [],
        classMode: 'ONLINE',
        pricePerSession: 480000,
        teacherPayPerSession: 260000,
        teacherPayPerStudent: 0,
      },
    ]);

    const pendingProfile = await teacherProfileModel.create({
      userId: pendingTeacherUser._id,
      subjects: ['Physics'],
      grades: ['Grade 8'],
      teachingMode: 'OFFLINE',
      locations: ['District 3'],
      bio: 'Pending teacher profile',
      qualifications: [],
      yearsOfExperience: 2,
      availability: [],
      pricePerSession: 300000,
      status: 'PENDING',
      bankInfo: {
        bankName: 'Hidden Bank',
        accountNumber: '987654321',
        accountHolderName: pendingTeacher.fullName,
      },
      adminNotes: 'Pending internal note',
    });
    pendingTeacherProfileId = String(pendingProfile._id);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('logs in and issues access + XSRF cookies across login/me flow', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    expect(session.accessToken.length).toBeGreaterThan(10);
    expect(session.xsrfToken.length).toBeGreaterThan(10);
  });

  it('rejects state-changing request without X-XSRF-TOKEN header', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', session.cookieHeader)
      .expect(403);
  });

  it('accepts state-changing request when CSRF cookie/header match', async () => {
    const session = await loginAndGetSession(director.email, director.password);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  });

  it('enforces RBAC on /users endpoint', async () => {
    const parentSession = await loginAndGetSession(parent.email, parent.password);
    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', parentSession.cookieHeader)
      .expect(403);

    const directorSession = await loginAndGetSession(director.email, director.password);
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', directorSession.cookieHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lets DIRECTOR assign managed sales right when creating a teacher account', async () => {
    const directorSession = await getPersistentSession(director);
    const createRes = await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', directorSession.cookieHeader)
      .set('X-XSRF-TOKEN', directorSession.xsrfToken)
      .send({
        userCode: 'GV-CREATE-01',
        email: 'teacher-create-managed.e2e@school.local',
        password: 'CreateManaged123!',
        fullName: 'Teacher Created With Sales',
        role: 'TEACHER',
        managedSales: [saleUserId, saleBUserId],
      })
      .expect(201);

    expect(createRes.body.role).toBe('TEACHER');
    expect(createRes.body.userCode).toBe('GV-CREATE-01');

    const createdUser: any = await userModel.findOne({ email: 'teacher-create-managed.e2e@school.local' }).lean();
    expect(createdUser).toBeTruthy();

    const createdProfile: any = await teacherProfileModel
      .findOne({ userId: createdUser!._id })
      .populate('managedSales', 'fullName role')
      .lean();

    expect(createdProfile).toBeTruthy();
    expect(createdProfile.pricePerSession).toBe(0);
    expect(createdProfile.status).toBe('PENDING');
    expect(Array.isArray(createdProfile.managedSales)).toBe(true);
    expect(createdProfile.managedSales).toHaveLength(2);

    const managedSaleIds = createdProfile.managedSales.map((item: any) =>
      item?._id?.toString?.() || item?.toString?.(),
    );
    expect(managedSaleIds).toEqual(expect.arrayContaining([saleUserId, saleBUserId]));

    const directorTeacherDetail = await request(app.getHttpServer())
      .get(`/teachers/${createdProfile._id}`)
      .set('Cookie', directorSession.cookieHeader)
      .expect(200);

    expect(directorTeacherDetail.body.managedSales).toHaveLength(2);
  });

  it('sanitizes teacher profile data for SALE users and hides non-active profiles', async () => {
    const saleSession = await loginAndGetSession(sale.email, sale.password);
    const saleBSession = await loginAndGetSession(saleB.email, saleB.password);

    const listRes = await request(app.getHttpServer())
      .get('/teachers')
      .set('Cookie', saleSession.cookieHeader)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(
      listRes.body.some((item: any) => item.userId?.fullName === approvedTeacher.fullName),
    ).toBe(true);
    expect(
      listRes.body.some((item: any) => item.userId?.fullName === pendingTeacher.fullName),
    ).toBe(false);

    const approvedFromList = listRes.body.find(
      (item: any) => item.userId?.fullName === approvedTeacher.fullName,
    );
    expect(approvedFromList).toBeTruthy();
    expect(approvedFromList.bankInfo).toBeUndefined();
    expect(approvedFromList.adminNotes).toBeUndefined();
    expect(approvedFromList.approvedBy).toBeUndefined();
    expect(approvedFromList.approvedAt).toBeUndefined();

    const saleBListRes = await request(app.getHttpServer())
      .get('/teachers')
      .set('Cookie', saleBSession.cookieHeader)
      .expect(200);
    expect(
      saleBListRes.body.some((item: any) => item.userId?.fullName === approvedTeacher.fullName),
    ).toBe(true);

    const detailRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', saleSession.cookieHeader)
      .expect(200);

    expect(detailRes.body.bankInfo).toBeUndefined();
    expect(detailRes.body.adminNotes).toBeUndefined();
    expect(detailRes.body.approvedBy).toBeUndefined();
    expect(detailRes.body.approvedAt).toBeUndefined();

    const fullProfileRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}/profile`)
      .set('Cookie', saleSession.cookieHeader)
      .expect(200);
    expect(fullProfileRes.body.profile.bankInfo).toBeUndefined();
    expect(fullProfileRes.body.payroll.totalPaid).toBe(0);
    expect(fullProfileRes.body.classes.active).toHaveLength(1);
    expect(fullProfileRes.body.classes.active[0].code).toBe('RBAC-A-CLASS');
    expect(fullProfileRes.body.classes.active[0].teacherPayPerSession).toBeUndefined();

    const saleBFullProfileRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}/profile`)
      .set('Cookie', saleBSession.cookieHeader)
      .expect(200);
    expect(saleBFullProfileRes.body.classes.active).toHaveLength(1);
    expect(saleBFullProfileRes.body.classes.active[0].code).toBe('RBAC-B-CLASS');

    await request(app.getHttpServer())
      .get(`/teachers/${pendingTeacherProfileId}`)
      .set('Cookie', saleSession.cookieHeader)
      .expect(404);
  });

  it('lets one SALE update shared teacher info while keeping managed sales read-only', async () => {
    const saleSession = await loginAndGetSession(sale.email, sale.password);
    const saleBSession = await loginAndGetSession(saleB.email, saleB.password);
    const directorSession = await getPersistentSession(director);

    const updateRes = await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', saleSession.cookieHeader)
      .set('X-XSRF-TOKEN', saleSession.xsrfToken)
      .send({
        user: {
          fullName: 'Teacher Shared Update',
          phone: '0909000999',
        },
        bio: 'Updated by sale A',
        bankInfo: {
          bankName: 'Sale Override Bank',
          accountNumber: '000111222',
          accountHolderName: 'Sale Should Not Change',
        },
        status: 'SUSPENDED',
        adminNotes: 'Sale should not change this',
        managedSales: [],
      })
      .expect(200);

    expect(updateRes.body.userId.fullName).toBe('Teacher Shared Update');
    expect(updateRes.body.userId.phone).toBe('0909000999');
    expect(Array.isArray(updateRes.body.managedSales)).toBe(true);
    expect(updateRes.body.managedSales).toHaveLength(2);

    const saleBDetailRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', saleBSession.cookieHeader)
      .expect(200);

    expect(saleBDetailRes.body.userId.fullName).toBe('Teacher Shared Update');
    expect(saleBDetailRes.body.userId.phone).toBe('0909000999');
    expect(saleBDetailRes.body.managedSales).toHaveLength(2);

    const directorDetailRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', directorSession.cookieHeader)
      .expect(200);

    expect(directorDetailRes.body.status).toBe('APPROVED');
    expect(directorDetailRes.body.adminNotes).toBe('Internal-only note');
    expect(directorDetailRes.body.bankInfo.bankName).toBe('Secure Bank');
    expect(directorDetailRes.body.bankInfo.accountNumber).toBe('123456789');
  });

  it('lets ACCOUNTING update shared teacher profile and bank info without changing managed sales', async () => {
    const accountingSession = await getPersistentSession(accounting);
    const directorSession = await getPersistentSession(director);
    const saleSession = await getPersistentSession(sale);

    const updateRes = await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', accountingSession.cookieHeader)
      .set('X-XSRF-TOKEN', accountingSession.xsrfToken)
      .send({
        user: {
          email: 'teacher-approved-updated.e2e@school.local',
        },
        bankInfo: {
          bankName: 'Accounting Bank',
          accountNumber: '555666777',
          accountHolderName: 'Teacher Shared Update',
          branch: 'District 5',
        },
        status: 'SUSPENDED',
        adminNotes: 'Accounting should not change this',
        managedSales: [],
      })
      .expect(200);

    expect(updateRes.body.userId.email).toBe('teacher-approved-updated.e2e@school.local');
    expect(updateRes.body.bankInfo.bankName).toBe('Accounting Bank');
    expect(updateRes.body.managedSales).toHaveLength(2);

    const directorDetailRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', directorSession.cookieHeader)
      .expect(200);

    expect(directorDetailRes.body.userId.email).toBe('teacher-approved-updated.e2e@school.local');
    expect(directorDetailRes.body.bankInfo.bankName).toBe('Accounting Bank');
    expect(directorDetailRes.body.bankInfo.accountNumber).toBe('555666777');
    expect(directorDetailRes.body.status).toBe('APPROVED');
    expect(directorDetailRes.body.adminNotes).toBe('Internal-only note');

    const saleDetailRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', saleSession.cookieHeader)
      .expect(200);

    expect(saleDetailRes.body.userId.email).toBe('teacher-approved-updated.e2e@school.local');
    expect(saleDetailRes.body.bankInfo).toBeUndefined();
  });

  it('rejects password changes from SALE and ACCOUNTING', async () => {
    const saleSession = await loginAndGetSession(sale.email, sale.password);
    const accountingSession = await loginAndGetSession(accounting.email, accounting.password);

    await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', saleSession.cookieHeader)
      .set('X-XSRF-TOKEN', saleSession.xsrfToken)
      .send({
        user: {
          password: 'SaleCannot123!',
        },
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', accountingSession.cookieHeader)
      .set('X-XSRF-TOKEN', accountingSession.xsrfToken)
      .send({
        user: {
          password: 'AccountingCannot123!',
        },
      })
      .expect(403);
  });

  it('rejects password change attempts from TEACHER and keeps the current password unchanged', async () => {
    const teacherSession = await loginAndGetSession(
      'teacher-approved-updated.e2e@school.local',
      approvedTeacher.password,
    );

    await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', teacherSession.cookieHeader)
      .set('X-XSRF-TOKEN', teacherSession.xsrfToken)
      .send({
        user: {
          password: 'TeacherCannot123!',
        },
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'teacher-approved-updated.e2e@school.local', password: 'TeacherCannot123!' })
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  it('lets DIRECTOR update managed sales while sale visibility still follows assigned classes', async () => {
    const directorSession = await getPersistentSession(director);
    const saleSession = await getPersistentSession(sale);
    const saleBSession = await getPersistentSession(saleB);

    const updateRes = await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', directorSession.cookieHeader)
      .set('X-XSRF-TOKEN', directorSession.xsrfToken)
      .send({
        managedSales: [saleUserId],
      })
      .expect(200);

    expect(updateRes.body.managedSales).toHaveLength(1);
    const firstManagedSale = updateRes.body.managedSales[0];
    expect(typeof firstManagedSale === 'string' ? firstManagedSale : firstManagedSale._id).toBe(saleUserId);

    const saleAListRes = await request(app.getHttpServer())
      .get('/teachers')
      .set('Cookie', saleSession.cookieHeader)
      .expect(200);
    expect(
      saleAListRes.body.some((item: any) => item._id === approvedTeacherProfileId),
    ).toBe(true);

    const saleBListRes = await request(app.getHttpServer())
      .get('/teachers')
      .set('Cookie', saleBSession.cookieHeader)
      .expect(200);
    expect(
      saleBListRes.body.some((item: any) => item._id === approvedTeacherProfileId),
    ).toBe(true);

    const saleBProfileRes = await request(app.getHttpServer())
      .get(`/teachers/${approvedTeacherProfileId}/profile`)
      .set('Cookie', saleBSession.cookieHeader)
      .expect(200);

    expect(saleBProfileRes.body.classes.active).toHaveLength(1);
    expect(saleBProfileRes.body.classes.active[0].code).toBe('RBAC-B-CLASS');
  });

  it('lets DIRECTOR change teacher password and the new password takes effect immediately', async () => {
    const directorSession = await getPersistentSession(director);
    const newTeacherPassword = 'TeacherNewPass123!';

    await request(app.getHttpServer())
      .patch(`/teachers/${approvedTeacherProfileId}`)
      .set('Cookie', directorSession.cookieHeader)
      .set('X-XSRF-TOKEN', directorSession.xsrfToken)
      .send({
        user: {
          password: newTeacherPassword,
        },
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'teacher-approved-updated.e2e@school.local', password: approvedTeacher.password })
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'teacher-approved-updated.e2e@school.local', password: newTeacherPassword })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const accessToken = extractCookieValue(loginRes.headers['set-cookie'], 'access_token');
    expect(accessToken).toBeTruthy();
  });
});
