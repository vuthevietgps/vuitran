import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
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
  role: 'DIRECTOR' | 'OPS' | 'SALE' | 'TEACHER';
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

describe('Product propagation (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;
  let productModel: Model<any>;

  const director: SeedUser = {
    email: 'director-product.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Product E2E',
    role: 'DIRECTOR',
  };

  const ops: SeedUser = {
    email: 'ops-product.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Product E2E',
    role: 'OPS',
  };

  const sale: SeedUser = {
    email: 'sale-product.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Sale Product E2E',
    role: 'SALE',
  };

  const teacher: SeedUser = {
    email: 'teacher-product.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher Product E2E',
    role: 'TEACHER',
  };

  let directorUser: any;
  let opsUser: any;
  let saleUser: any;
  let teacherUser: any;

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let saleSession: SessionCookies;

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

  function authedPost(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedGet(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  function authedPatch(session: SessionCookies, path: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  async function resetBusinessCollections() {
    await Promise.all([
      classModel.deleteMany({}),
      studentModel.deleteMany({}),
      productModel.deleteMany({}),
    ]);
  }

  beforeAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri('school-mgmt-product-propagation-e2e');

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
    classModel = moduleRef.get<Model<any>>(getModelToken('Classroom'));
    productModel = moduleRef.get<Model<any>>(getModelToken('Product'));

    directorUser = await upsertUser(director);
    opsUser = await upsertUser(ops);
    saleUser = await upsertUser(sale);
    teacherUser = await upsertUser(teacher);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    saleSession = await loginAndGetSession(sale.email, sale.password);
  });

  beforeEach(async () => {
    await resetBusinessCollections();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('propagates product creation and updates to sale, ops, students, and classes', async () => {
    const createProductRes = await authedPost(directorSession, '/products')
      .send({
        name: 'Goi tieng anh starter',
        teachingMode: 'ONLINE',
        defaultSessions: 24,
        defaultSessionDuration: 90,
        pricePerSession: 250000,
        suggestedPrice: 6000000,
      })
      .expect(201);

    expect(createProductRes.body.name).toBe('Goi tieng anh starter');
    expect(createProductRes.body.category).toBe('ENGLISH');
    expect(createProductRes.body.code).toMatch(/^PKG/);

    const productId = createProductRes.body._id;

    const saleProductsRes = await authedGet(saleSession, '/products').expect(200);
    expect(Array.isArray(saleProductsRes.body)).toBe(true);
    expect(
      saleProductsRes.body.some((product: any) => product._id === productId && product.category === 'ENGLISH'),
    ).toBe(true);

    const opsProductsRes = await authedGet(opsSession, '/products').expect(200);
    expect(Array.isArray(opsProductsRes.body)).toBe(true);
    expect(
      opsProductsRes.body.some((product: any) => product._id === productId && product.name === 'Goi tieng anh starter'),
    ).toBe(true);

    const createStudentRes = await authedPost(directorSession, '/students')
      .send({
        studentCode: 'HS-PROD-0001',
        fullName: 'Hoc sinh goi san pham',
        age: 12,
        parentName: 'Phu huynh goi san pham',
        parentPhone: '0909990001',
        faceImage: 'default-avatar.png',
        productPackage: productId,
        saleId: saleUser._id.toString(),
        saleName: saleUser.fullName,
      })
      .expect(201);

    const studentId = createStudentRes.body._id;

    const createClassRes = await authedPost(directorSession, '/classes')
      .send({
        name: 'Lop san pham 01',
        code: 'CLS-PROD-01',
        teacherId: teacherUser._id.toString(),
        saleId: saleUser._id.toString(),
        classMode: 'ONLINE',
        productPackageId: productId,
        studentIds: [studentId],
        subject: 'Tieng Anh',
        learningGoals: 'Cung co giao tiep co ban',
        pricePerSession: 250000,
        teacherPayPerSession: 120000,
        baseDuration: 90,
        sessionDuration: 90,
      })
      .expect(201);

    const classId = createClassRes.body._id;

    const studentBeforeUpdateRes = await authedGet(directorSession, `/students/${studentId}`).expect(200);
    expect(studentBeforeUpdateRes.body.productPackage?._id).toBe(productId);
    expect(studentBeforeUpdateRes.body.productPackage?.name).toBe('Goi tieng anh starter');

    const classBeforeUpdateRes = await authedGet(directorSession, `/classes/${classId}`).expect(200);
    expect(classBeforeUpdateRes.body.productPackage?._id).toBe(productId);
    expect(classBeforeUpdateRes.body.productPackage?.name).toBe('Goi tieng anh starter');
    expect(classBeforeUpdateRes.body.productPackage?.teachingMode).toBe('ONLINE');

    const updateProductRes = await authedPatch(directorSession, `/products/${productId}`)
      .send({
        name: 'Goi tieng anh nang cao',
        category: 'ENGLISH',
        teachingMode: 'BOTH',
        pricePerSession: 320000,
        suggestedPrice: 7680000,
      })
      .expect(200);

    expect(updateProductRes.body.name).toBe('Goi tieng anh nang cao');
    expect(updateProductRes.body.teachingMode).toBe('BOTH');

    const saleProductsAfterUpdateRes = await authedGet(saleSession, '/products').expect(200);
    expect(
      saleProductsAfterUpdateRes.body.some(
        (product: any) =>
          product._id === productId
          && product.name === 'Goi tieng anh nang cao'
          && product.teachingMode === 'BOTH',
      ),
    ).toBe(true);

    const studentAfterUpdateRes = await authedGet(directorSession, `/students/${studentId}`).expect(200);
    expect(studentAfterUpdateRes.body.productPackage?._id).toBe(productId);
    expect(studentAfterUpdateRes.body.productPackage?.name).toBe('Goi tieng anh nang cao');

    const classAfterUpdateRes = await authedGet(directorSession, `/classes/${classId}`).expect(200);
    expect(classAfterUpdateRes.body.productPackage?._id).toBe(productId);
    expect(classAfterUpdateRes.body.productPackage?.name).toBe('Goi tieng anh nang cao');
    expect(classAfterUpdateRes.body.productPackage?.teachingMode).toBe('BOTH');
    expect(classAfterUpdateRes.body.productPackage?.suggestedPrice).toBe(7680000);
  });

  it('allows only director to mutate products while sale and ops can consume the list', async () => {
    const createProductRes = await authedPost(directorSession, '/products')
      .send({
        name: 'Goi toan co ban',
        category: 'MATH',
        teachingMode: 'OFFLINE',
        defaultSessions: 16,
        defaultSessionDuration: 90,
      })
      .expect(201);

    const productId = createProductRes.body._id;

    await authedPost(saleSession, '/products')
      .send({ name: 'Sale khong duoc tao goi' })
      .expect(403);

    await authedPost(opsSession, '/products')
      .send({ name: 'Ops khong duoc tao goi' })
      .expect(403);

    await authedPatch(saleSession, `/products/${productId}`)
      .send({ name: 'Sale khong duoc sua' })
      .expect(403);

    await authedPatch(opsSession, `/products/${productId}`)
      .send({ name: 'Ops khong duoc sua' })
      .expect(403);

    await authedGet(saleSession, '/products').expect(200);
    await authedGet(opsSession, '/products').expect(200);
  });
});
