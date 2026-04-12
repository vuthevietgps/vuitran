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
import { Role } from '../src/common/interfaces/role.enum';
import { UserStatus } from '../src/common/interfaces/user-status.enum';

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  userCode: string;
  phone?: string;
  saleOwnerId?: string;
  saleOwnerName?: string;
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

function uniqueSuffix(): string {
  return new Types.ObjectId().toHexString().slice(-8).toUpperCase();
}

describe('Data isolation and RBAC (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let orderModel: Model<any>;
  let productModel: Model<any>;

  const saleA: SeedUser = {
    email: 'sale-a.data-isolation.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale A Data Isolation',
    role: Role.SALE,
    userCode: 'SALE-ISO-A',
  };

  const saleB: SeedUser = {
    email: 'sale-b.data-isolation.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale B Data Isolation',
    role: Role.SALE,
    userCode: 'SALE-ISO-B',
  };

  const parentX: SeedUser = {
    email: 'parent-x.data-isolation.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent X Data Isolation',
    role: Role.PARENT,
    userCode: 'PARENT-ISO-X',
    phone: '0903000001',
    saleOwnerName: saleA.fullName,
  };

  const parentY: SeedUser = {
    email: 'parent-y.data-isolation.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent Y Data Isolation',
    role: Role.PARENT,
    userCode: 'PARENT-ISO-Y',
    phone: '0903000002',
    saleOwnerName: saleB.fullName,
  };

  const ops: SeedUser = {
    email: 'ops.data-isolation.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Data Isolation',
    role: Role.OPS,
    userCode: 'OPS-ISO',
  };

  let saleAUser: any;
  let saleBUser: any;
  let parentXUser: any;
  let parentYUser: any;
  let opsUser: any;

  let saleASession: SessionCookies;
  let saleBSession: SessionCookies;
  let parentXSession: SessionCookies;
  let parentYSession: SessionCookies;
  let opsSession: SessionCookies;
  let boundaryFixtures: {
    product: any;
    studentA: any;
    studentB: any;
    orderA: any;
    orderB: any;
  };

  async function upsertUser(user: SeedUser): Promise<any> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const set: Record<string, unknown> = {
      email: user.email,
      userCode: user.userCode,
      password: hashedPassword,
      fullName: user.fullName,
      role: user.role,
      status: UserStatus.ACTIVE,
    };

    if (user.phone) {
      set.phone = user.phone;
    }
    if (user.saleOwnerName) {
      set.saleOwnerName = user.saleOwnerName;
    }
    if (user.saleOwnerId) {
      set.saleOwnerId = new Types.ObjectId(user.saleOwnerId);
    }

    await userModel.updateOne(
      { email: user.email },
      {
        $set: set,
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

  async function resetCollections() {
    await Promise.all([
      orderModel.deleteMany({}),
      studentModel.deleteMany({}),
      productModel.deleteMany({}),
    ]);
  }

  async function seedBoundaryFixtures() {
    const suffix = uniqueSuffix();

    const product = await productModel.create({
      name: `Boundary Product ${suffix}`,
      code: `PRD-ISO-${suffix}`,
      teachingMode: 'OFFLINE',
      defaultSessions: 12,
      defaultSessionDuration: 90,
      pricePerSession: 150000,
      suggestedPrice: 1800000,
      commissionRate: 5,
      isActive: true,
    });

    const studentA = await studentModel.create({
      studentCode: `STU-ISO-A-${suffix}`,
      fullName: 'Student Alpha Isolation',
      age: 10,
      parentName: parentX.fullName,
      parentPhone: parentX.phone,
      parentUserId: parentXUser._id,
      saleId: saleAUser._id,
      saleName: saleAUser.fullName,
      faceImage: 'data:image/png;base64,alpha',
      productPackage: product._id,
    });

    const studentB = await studentModel.create({
      studentCode: `STU-ISO-B-${suffix}`,
      fullName: 'Student Beta Isolation',
      age: 11,
      parentName: parentY.fullName,
      parentPhone: parentY.phone,
      parentUserId: parentYUser._id,
      saleId: saleBUser._id,
      saleName: saleBUser.fullName,
      faceImage: 'data:image/png;base64,beta',
      productPackage: product._id,
    });

    const orderA = await orderModel.create({
      orderCode: `ORD-ISO-A-${suffix}`,
      orderType: 'NEW_ENROLLMENT',
      status: 'DRAFT',
      parentName: parentX.fullName,
      parentPhone: parentX.phone,
      parentUserId: parentXUser._id,
      studentName: studentA.fullName,
      existingStudentId: studentA._id,
      items: [
        {
          productId: product._id,
          productName: product.name,
          sessions: 12,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 1800000,
        },
      ],
      totalAmount: 1800000,
      finalAmount: 1800000,
      saleId: saleAUser._id,
      saleName: saleAUser.fullName,
    });

    const orderB = await orderModel.create({
      orderCode: `ORD-ISO-B-${suffix}`,
      orderType: 'NEW_ENROLLMENT',
      status: 'DRAFT',
      parentName: parentY.fullName,
      parentPhone: parentY.phone,
      parentUserId: parentYUser._id,
      studentName: studentB.fullName,
      existingStudentId: studentB._id,
      items: [
        {
          productId: product._id,
          productName: product.name,
          sessions: 12,
          sessionDuration: 90,
          pricePerSession: 150000,
          amount: 1800000,
        },
      ],
      totalAmount: 1800000,
      finalAmount: 1800000,
      saleId: saleBUser._id,
      saleName: saleBUser.fullName,
    });

    return { product, studentA, studentB, orderA, orderB };
  }

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-data-isolation-rbac-e2e');

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
    studentModel = moduleRef.get<Model<any>>(getModelToken('Student'));
    orderModel = moduleRef.get<Model<any>>(getModelToken('Order'));
    productModel = moduleRef.get<Model<any>>(getModelToken('Product'));

    saleAUser = await upsertUser(saleA);
    saleBUser = await upsertUser(saleB);
    parentXUser = await upsertUser({
      ...parentX,
      saleOwnerId: String(saleAUser._id),
      saleOwnerName: saleAUser.fullName,
    });
    parentYUser = await upsertUser({
      ...parentY,
      saleOwnerId: String(saleBUser._id),
      saleOwnerName: saleBUser.fullName,
    });
    opsUser = await upsertUser(ops);

    saleASession = await loginAndGetSession(saleA.email, saleA.password);
    saleBSession = await loginAndGetSession(saleB.email, saleB.password);
    parentXSession = await loginAndGetSession(parentX.email, parentX.password);
    parentYSession = await loginAndGetSession(parentY.email, parentY.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
  });

  beforeEach(async () => {
    await resetCollections();
    boundaryFixtures = await seedBoundaryFixtures();
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  it('keeps order ownership scoped to the owning sale', async () => {
    const saleOrders = await authedGet(saleASession, '/orders').expect(200);
    expect(saleOrders.body.total).toBe(1);
    expect(Array.isArray(saleOrders.body.data)).toBe(true);
    expect(saleOrders.body.data).toHaveLength(1);
    expect(String(saleOrders.body.data[0]._id)).toBe(String(boundaryFixtures.orderA._id));
    expect(String(saleOrders.body.data[0].saleId)).toBe(String(saleAUser._id));

    await authedGet(saleASession, `/orders/${boundaryFixtures.orderB._id}`).expect((res) => {
      expect([403, 404]).toContain(res.status);
    });
  });

  it('blocks a parent from reading another parent student record', async () => {
    await authedGet(parentXSession, `/students/${boundaryFixtures.studentB._id}`).expect(404);
  });

  it('blocks OPS from POST /wallets/adjust', async () => {
    await authedPost(opsSession, '/wallets/adjust')
      .send({
        userId: String(parentXUser._id),
        amount: 50000,
        direction: 'ADD',
        description: 'RBAC isolation test',
        reason: 'Should be rejected before body handling',
      })
      .expect(403);
  });
});
