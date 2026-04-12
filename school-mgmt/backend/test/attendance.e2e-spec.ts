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

type SessionCookies = {
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
};

type SeedUser = {
  email: string;
  password: string;
  fullName: string;
  role: 'DIRECTOR' | 'OPS' | 'TEACHER' | 'PARENT';
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

function dateYmdFromNow(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const ONE_PIXEL_PNG_BASE64 =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W3ioAAAAASUVORK5CYII=';

describe('Attendance module (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let replSet: MongoMemoryReplSet;

  let userModel: Model<any>;
  let studentModel: Model<any>;
  let classModel: Model<any>;

  const director: SeedUser = {
    email: 'director.att.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Director Attendance',
    role: 'DIRECTOR',
  };
  const ops: SeedUser = {
    email: 'ops.att.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Ops Attendance',
    role: 'OPS',
  };
  const teacherA: SeedUser = {
    email: 'teacher.a.att.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher A',
    role: 'TEACHER',
  };
  const teacherB: SeedUser = {
    email: 'teacher.b.att.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Teacher B',
    role: 'TEACHER',
  };
  const parent: SeedUser = {
    email: 'parent.att.e2e@school.local',
    password: 'E2ePass123!',
    fullName: 'Parent Attendance',
    role: 'PARENT',
  };

  let directorSession: SessionCookies;
  let opsSession: SessionCookies;
  let teacherASession: SessionCookies;
  let parentSession: SessionCookies;

  let teacherAId: string;
  let teacherBId: string;
  let parentId: string;
  let classAId: string;
  let classBId: string;
  let student1Id: string;
  let student2Id: string;
  let foreignStudentId: string;
  let attendanceForUpdateId: string;
  let generatedToken: string;

  const d1 = dateYmdFromNow(-1);
  const d2 = dateYmdFromNow(0);
  const d3 = dateYmdFromNow(1);

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

  function authGet(agent: any, session: SessionCookies): any {
    return agent.set('Cookie', session.cookieHeader);
  }

  function authWrite(agent: any, session: SessionCookies): any {
    return agent
      .set('Cookie', session.cookieHeader)
      .set('X-XSRF-TOKEN', session.xsrfToken);
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    process.env.MONGODB_URI = replSet.getUri('school-mgmt-attendance-e2e');

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

    const directorDoc = await upsertUser(director);
    const opsDoc = await upsertUser(ops);
    const teacherADoc = await upsertUser(teacherA);
    const teacherBDoc = await upsertUser(teacherB);
    const parentDoc = await upsertUser(parent);

    teacherAId = String(teacherADoc._id);
    teacherBId = String(teacherBDoc._id);
    parentId = String(parentDoc._id);

    const student1 = await studentModel.create({
      studentCode: 'ATT-S1',
      fullName: 'Student One',
      age: 10,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: '0900000001',
      faceImage: 'seed-face-1.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(opsDoc._id),
      approvedAt: new Date(),
      subjects: ['Toan'],
      grade: '5',
    });
    student1Id = String(student1._id);

    const student2 = await studentModel.create({
      studentCode: 'ATT-S2',
      fullName: 'Student Two',
      age: 11,
      parentUserId: new Types.ObjectId(parentId),
      parentName: parent.fullName,
      parentPhone: '0900000001',
      faceImage: 'seed-face-2.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(opsDoc._id),
      approvedAt: new Date(),
      subjects: ['Van'],
      grade: '6',
    });
    student2Id = String(student2._id);

    const foreignStudent = await studentModel.create({
      studentCode: 'ATT-S3',
      fullName: 'Student Foreign',
      age: 12,
      parentName: 'Another Parent',
      parentPhone: '0900000009',
      faceImage: 'seed-face-3.jpg',
      approvalStatus: 'APPROVED',
      approvedBy: new Types.ObjectId(directorDoc._id),
      approvedAt: new Date(),
      subjects: ['Anh'],
      grade: '7',
    });
    foreignStudentId = String(foreignStudent._id);

    const classA = await classModel.create({
      name: 'Class Attendance A',
      code: 'ATT-CLASS-A',
      teacher: new Types.ObjectId(teacherAId),
      students: [new Types.ObjectId(student1Id), new Types.ObjectId(student2Id)],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 100000,
      teacherPayPerSession: 50000,
      teacherPayPerStudent: 20000,
      status: 'ACTIVE',
    });
    classAId = String(classA._id);

    const classB = await classModel.create({
      name: 'Class Attendance B',
      code: 'ATT-CLASS-B',
      teacher: new Types.ObjectId(teacherBId),
      students: [new Types.ObjectId(foreignStudentId)],
      classMode: 'ONLINE',
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 120000,
      teacherPayPerSession: 60000,
      teacherPayPerStudent: 25000,
      status: 'ACTIVE',
    });
    classBId = String(classB._id);

    directorSession = await loginAndGetSession(director.email, director.password);
    opsSession = await loginAndGetSession(ops.email, ops.password);
    teacherASession = await loginAndGetSession(teacherA.email, teacherA.password);
    parentSession = await loginAndGetSession(parent.email, parent.password);
  });

  afterAll(async () => {
    await closeE2eResources({ app, moduleRef, mongoReplSet: replSet });
  });

  it('denies parent from marking attendance', async () => {
    await authWrite(
      request(app.getHttpServer()).post('/attendance/mark'),
      parentSession,
    )
      .send({
        classId: classAId,
        studentId: student1Id,
        date: d1,
        status: 'PRESENT',
      })
      .expect(403);
  });

  it('allows OPS to mark attendance and create session bridge', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/attendance/mark'),
      opsSession,
    )
      .send({
        classId: classAId,
        studentId: student1Id,
        date: d1,
        status: 'PRESENT',
        notes: 'on-time',
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    expect(res.body.status).toBe('PRESENT');
    expect(res.body.sessionCreated).toBe(true);
    expect(res.body.sessionId).toBeTruthy();
  });

  it('allows OPS to mark another attendance for update/stats scenarios', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/attendance/mark'),
      opsSession,
    )
      .send({
        classId: classAId,
        studentId: student2Id,
        date: d1,
        status: 'LATE',
        notes: 'late 5m',
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    attendanceForUpdateId = String(res.body._id);
    expect(attendanceForUpdateId).toBeTruthy();
    expect(res.body.status).toBe('LATE');
  });

  it('returns class attendance list for teacher of that class', async () => {
    const res = await authGet(
      request(app.getHttpServer()).get(`/attendance/class/${classAId}?date=${d1}`),
      teacherASession,
    ).expect(200);

    expect(res.body.class.code).toBe('ATT-CLASS-A');
    expect(Array.isArray(res.body.attendanceList)).toBe(true);
    expect(res.body.attendanceList.length).toBe(2);
    const statuses = res.body.attendanceList.map((x: any) => x.attendance.status);
    expect(statuses).toContain('PRESENT');
    expect(statuses).toContain('LATE');
  });

  it('forbids teacher from reading attendance of another teacher class', async () => {
    await authGet(
      request(app.getHttpServer()).get(`/attendance/class/${classBId}?date=${d1}`),
      teacherASession,
    ).expect(403);
  });

  it('supports bulk mark attendance by OPS', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).post('/attendance/bulk-mark'),
      opsSession,
    )
      .send({
        classId: classAId,
        date: d2,
        attendances: [
          { studentId: student1Id, status: 'PRESENT', notes: 'bulk present' },
          { studentId: student2Id, status: 'ABSENT', notes: 'bulk absent' },
        ],
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    expect(Array.isArray(res.body.success)).toBe(true);
    expect(res.body.totalErrors).toBe(0);
    expect(res.body.totalProcessed).toBe(2);
  });

  it('allows update attendance by OPS', async () => {
    const res = await authWrite(
      request(app.getHttpServer()).patch(`/attendance/${attendanceForUpdateId}`),
      opsSession,
    )
      .send({
        status: 'ABSENT',
        notes: 'updated to absent',
      })
      .expect(200);

    expect(res.body.status).toBe('ABSENT');
    expect(res.body.notes).toBe('updated to absent');
  });

  it('returns attendance history by student', async () => {
    const res = await authGet(
      request(app.getHttpServer()).get(`/attendance/student/${student1Id}?classId=${classAId}`),
      opsSession,
    ).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('returns attendance stats by class', async () => {
    const res = await authGet(
      request(app.getHttpServer()).get(
        `/attendance/stats/${classAId}?startDate=${d1}&endDate=${d2}`,
      ),
      opsSession,
    ).expect(200);

    expect(res.body.classId).toBe(classAId);
    expect(Array.isArray(res.body.statistics)).toBe(true);
    expect(res.body.statistics.length).toBeGreaterThan(0);
  });

  it('returns teacher class assignments and classes-with-students', async () => {
    const teacherClasses = await authGet(
      request(app.getHttpServer()).get('/attendance/teacher/classes'),
      teacherASession,
    ).expect(200);
    expect(Array.isArray(teacherClasses.body)).toBe(true);
    expect(teacherClasses.body.some((c: any) => c.classCode === 'ATT-CLASS-A')).toBe(true);

    const classesWithStudents = await authGet(
      request(app.getHttpServer()).get('/attendance/classes-with-students'),
      teacherASession,
    ).expect(200);
    expect(Array.isArray(classesWithStudents.body)).toBe(true);
    expect(classesWithStudents.body.some((c: any) => c.classCode === 'ATT-CLASS-A')).toBe(true);
    expect(classesWithStudents.body.some((c: any) => c.classCode === 'ATT-CLASS-B')).toBe(false);
  });

  it('generates attendance link and allows public token lookup', async () => {
    const linkRes = await authWrite(
      request(app.getHttpServer()).post('/attendance/generate-link'),
      teacherASession,
    )
      .send({
        classId: classAId,
        studentId: student2Id,
        date: d3,
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    generatedToken = linkRes.body.token;
    expect(generatedToken).toBeTruthy();
    expect(String(linkRes.body.attendanceUrl || '')).toContain(generatedToken);

    const tokenRes = await request(app.getHttpServer())
      .get(`/public/attendance/token/${generatedToken}`)
      .expect(200);

    expect(tokenRes.body._id).toBeTruthy();
    expect(tokenRes.body.attendedAt).toBeFalsy();
  });

  it('rejects public submit with invalid image and accepts valid one', async () => {
    await request(app.getHttpServer())
      .post('/public/attendance/submit')
      .send({
        token: generatedToken,
        imageBase64: 'data:text/plain;base64,SGVsbG8=',
      })
      .expect(400);

    const submitRes = await request(app.getHttpServer())
      .post('/public/attendance/submit')
      .send({
        token: generatedToken,
        imageBase64: ONE_PIXEL_PNG_BASE64,
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    expect(submitRes.body.status).toBe('PRESENT');
    expect(String(submitRes.body.imageUrl || '')).toContain('/secure-assets');
    expect(submitRes.body.attendedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/public/attendance/token/${generatedToken}`)
      .expect(400);
  });

  it('returns parent children attendance and stats', async () => {
    const fromDate = dateYmdFromNow(-3);
    const toDate = dateYmdFromNow(3);

    const attendanceRes = await authGet(
      request(app.getHttpServer()).get(
        `/attendance/my-children?fromDate=${fromDate}&toDate=${toDate}`,
      ),
      parentSession,
    ).expect(200);

    expect(Array.isArray(attendanceRes.body.children)).toBe(true);
    expect(attendanceRes.body.children.length).toBe(2);
    expect(
      attendanceRes.body.children.some(
        (child: any) => String(child.student.studentCode).startsWith('ATT-S'),
      ),
    ).toBe(true);

    const statsRes = await authGet(
      request(app.getHttpServer()).get(
        `/attendance/my-children/stats?fromDate=${fromDate}&toDate=${toDate}`,
      ),
      parentSession,
    ).expect(200);

    expect(Array.isArray(statsRes.body.children)).toBe(true);
    expect(statsRes.body.children.length).toBe(2);
    expect(
      statsRes.body.children.every((item: any) => typeof item.presentRate === 'number'),
    ).toBe(true);
  });

  it('returns attendance report in date range for director', async () => {
    const fromDate = dateYmdFromNow(-3);
    const toDate = dateYmdFromNow(3);
    const res = await authGet(
      request(app.getHttpServer()).get(
        `/attendance/report?startDate=${fromDate}&endDate=${toDate}&classId=${classAId}`,
      ),
      directorSession,
    ).expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta?.total).toBeGreaterThan(0);
    expect(
      res.body.data.every((row: any) => ['PRESENT', 'LATE'].includes(row.status)),
    ).toBe(true);
  });
});
