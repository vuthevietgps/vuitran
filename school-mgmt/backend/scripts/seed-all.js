/**
 * seed-all.js — Tạo dữ liệu mẫu toàn bộ hệ thống
 *
 * Chạy:  node scripts/seed-all.js
 *
 * Dữ liệu tạo:
 *   • 7 demo users  (director, accounting, ops, teacher, parent, adsmanager, shareholder)  — giữ nguyên nếu đã có
 *   • 4 teacher users + teacher profiles
 *   • 3 sale users
 *   • 5 parent users
 *   • 15 students (gắn parentUserId)
 *   • 2 products (gói học)
 *   • 6 classes (đa dạng baseDuration, sessionDuration)
 *   • 30 sessions (đủ trạng thái: SCHEDULED, TEACHER_COMPLETED, PARENT_CONFIRMED, FINALIZED, CANCELLED)
 *   • 15 invoices
 *   • 40 attendance records
 *   • Wallets + ledger entries cho tất cả parent (top-up + session deduct)
 *   • 4 payroll records
 *   • 5 tickets
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ─────────── CONFIG ───────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-mgmt';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';
const SALT_ROUNDS = 10;

// ─────────── HELPERS ───────────
const oid = () => new mongoose.Types.ObjectId();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

// ─────────── PRE-GENERATED IDs ───────────
// Demo users (keep existing or create)
const ID = {
  director: oid(), accounting: oid(), ops: oid(),
  adsmanager: oid(), shareholder: oid(),
  // Teachers
  t1: oid(), t2: oid(), t3: oid(), t4: oid(),
  // Demo teacher (from admin.seeder)
  tDemo: oid(),
  // Sales
  s1: oid(), s2: oid(), s3: oid(),
  // Parents
  p1: oid(), p2: oid(), p3: oid(), p4: oid(), p5: oid(),
  // Demo parent
  pDemo: oid(),
  // Students
  st1: oid(), st2: oid(), st3: oid(), st4: oid(), st5: oid(),
  st6: oid(), st7: oid(), st8: oid(), st9: oid(), st10: oid(),
  st11: oid(), st12: oid(), st13: oid(), st14: oid(), st15: oid(),
  // Products
  prod1: oid(), prod2: oid(),
  // Classes
  c1: oid(), c2: oid(), c3: oid(), c4: oid(), c5: oid(), c6: oid(),
  // Wallets
  w1: oid(), w2: oid(), w3: oid(), w4: oid(), w5: oid(), wDemo: oid(),
};

async function main() {
  console.log('🔗 Connecting to', MONGO_URI.replace(/\/\/.*@/, '//<hidden>@'));
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  // ═══════════ 1. USERS ═══════════
  console.log('\n👤 Seeding users...');
  const usersCol = db.collection('users');

  // Check existing demo users
  const existingDemo = await usersCol.findOne({ email: 'director.demo@school.local' });
  let directorId, accountingId, opsId, adsManagerDemoId, shareholderDemoId, teacherDemoId, parentDemoId;
  let hasAdsManagerDemo = false;
  let hasShareholderDemo = false;

  if (existingDemo) {
    console.log('  ✅ Demo users already exist, keeping them');
    const demoUsers = await usersCol.find({ email: { $regex: /\.demo@school\.local$/ } }).toArray();
    for (const u of demoUsers) {
      if (u.role === 'DIRECTOR') directorId = u._id;
      if (u.role === 'ACCOUNTING') accountingId = u._id;
      if (u.role === 'OPS') opsId = u._id;
      if (u.role === 'ADSMANAGER') {
        adsManagerDemoId = u._id;
        hasAdsManagerDemo = true;
      }
      if (u.role === 'SHAREHOLDER') {
        shareholderDemoId = u._id;
        hasShareholderDemo = true;
      }
      if (u.role === 'TEACHER') teacherDemoId = u._id;
      if (u.role === 'PARENT') parentDemoId = u._id;
    }
  } else {
    directorId = ID.director;
    accountingId = ID.accounting;
    opsId = ID.ops;
    adsManagerDemoId = ID.adsmanager;
    shareholderDemoId = ID.shareholder;
    teacherDemoId = ID.tDemo;
    parentDemoId = ID.pDemo;
  }

  directorId ||= ID.director;
  accountingId ||= ID.accounting;
  opsId ||= ID.ops;
  adsManagerDemoId ||= ID.adsmanager;
  shareholderDemoId ||= ID.shareholder;
  teacherDemoId ||= ID.tDemo;
  parentDemoId ||= ID.pDemo;

  const now = new Date();
  const userDocs = [
    // Demo accounts (skip if exist)
    ...(!existingDemo ? [
      { _id: directorId, email: 'director.demo@school.local', password: hash, fullName: 'Giám đốc Demo', role: 'DIRECTOR', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: accountingId, email: 'accounting.demo@school.local', password: hash, fullName: 'Kế toán Demo', role: 'ACCOUNTING', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: opsId, email: 'ops.demo@school.local', password: hash, fullName: 'Vận hành Demo', role: 'OPS', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: adsManagerDemoId, email: 'adsmanager.demo@school.local', password: hash, fullName: 'Ads Manager Demo', role: 'ADSMANAGER', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: shareholderDemoId, email: 'shareholder.demo@school.local', password: hash, fullName: 'Shareholder Demo', role: 'SHAREHOLDER', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: teacherDemoId, email: 'teacher.demo@school.local', password: hash, fullName: 'Giáo viên Demo', role: 'TEACHER', status: 'ACTIVE', createdAt: now, updatedAt: now },
      { _id: parentDemoId, email: 'parent.demo@school.local', password: hash, fullName: 'Phụ huynh Demo', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
    ] : [
      ...(!hasAdsManagerDemo ? [
        { _id: adsManagerDemoId, email: 'adsmanager.demo@school.local', password: hash, fullName: 'Ads Manager Demo', role: 'ADSMANAGER', status: 'ACTIVE', createdAt: now, updatedAt: now },
      ] : []),
      ...(!hasShareholderDemo ? [
        { _id: shareholderDemoId, email: 'shareholder.demo@school.local', password: hash, fullName: 'Shareholder Demo', role: 'SHAREHOLDER', status: 'ACTIVE', createdAt: now, updatedAt: now },
      ] : []),
    ]),
    // Teachers
    { _id: ID.t1, email: 'nguyenvananh.gv@school.local', password: hash, fullName: 'Nguyễn Văn Anh', role: 'TEACHER', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.t2, email: 'tranthithuy.gv@school.local', password: hash, fullName: 'Trần Thị Thúy', role: 'TEACHER', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.t3, email: 'lequangminh.gv@school.local', password: hash, fullName: 'Lê Quang Minh', role: 'TEACHER', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.t4, email: 'phamthilan.gv@school.local', password: hash, fullName: 'Phạm Thị Lan', role: 'TEACHER', status: 'ACTIVE', createdAt: now, updatedAt: now },
    // Sales
    { _id: ID.s1, email: 'sale.huong@school.local', password: hash, fullName: 'Nguyễn Thị Hương', role: 'SALE', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.s2, email: 'sale.tuan@school.local', password: hash, fullName: 'Trần Văn Tuấn', role: 'SALE', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.s3, email: 'sale.mai@school.local', password: hash, fullName: 'Lê Thị Mai', role: 'SALE', status: 'ACTIVE', createdAt: now, updatedAt: now },
    // Parents
    { _id: ID.p1, email: 'ph.nguyenbinh@school.local', password: hash, fullName: 'Nguyễn Văn Bình', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.p2, email: 'ph.trancuong@school.local', password: hash, fullName: 'Trần Văn Cường', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.p3, email: 'ph.lehoang@school.local', password: hash, fullName: 'Lê Hoàng Nam', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.p4, email: 'ph.phamgiang@school.local', password: hash, fullName: 'Phạm Văn Giang', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
    { _id: ID.p5, email: 'ph.hoanglan@school.local', password: hash, fullName: 'Hoàng Thị Lan', role: 'PARENT', status: 'ACTIVE', createdAt: now, updatedAt: now },
  ];

  // Upsert users by email
  for (const u of userDocs) {
    await usersCol.updateOne({ email: u.email }, { $setOnInsert: u }, { upsert: true });
  }

  // Canonical sync for late-added Wave 0 roles used by frontend/fullstack campaign.
  const canonicalExtraDemoUsers = [
    {
      email: 'adsmanager.demo@school.local',
      fullName: 'Ads Manager Demo',
      role: 'ADSMANAGER',
    },
    {
      email: 'shareholder.demo@school.local',
      fullName: 'Shareholder Demo',
      role: 'SHAREHOLDER',
    },
  ];

  for (const demoUser of canonicalExtraDemoUsers) {
    await usersCol.updateOne(
      { email: demoUser.email },
      {
        $set: {
          fullName: demoUser.fullName,
          role: demoUser.role,
          password: hash,
          status: 'ACTIVE',
          updatedAt: now,
        },
        $setOnInsert: {
          email: demoUser.email,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
  console.log(`  ✅ ${userDocs.length} users upserted`);

  // Reload teacher/parent IDs in case they existed before
  const allUsers = await usersCol.find({
    email: { $in: userDocs.map(u => u.email) }
  }).toArray();
  const emailToId = {};
  for (const u of allUsers) emailToId[u.email] = u._id;

  // Resolve actual IDs
  const T1 = emailToId['nguyenvananh.gv@school.local'];
  const T2 = emailToId['tranthithuy.gv@school.local'];
  const T3 = emailToId['lequangminh.gv@school.local'];
  const T4 = emailToId['phamthilan.gv@school.local'];
  const S1 = emailToId['sale.huong@school.local'];
  const S2 = emailToId['sale.tuan@school.local'];
  const S3 = emailToId['sale.mai@school.local'];
  const P1 = emailToId['ph.nguyenbinh@school.local'];
  const P2 = emailToId['ph.trancuong@school.local'];
  const P3 = emailToId['ph.lehoang@school.local'];
  const P4 = emailToId['ph.phamgiang@school.local'];
  const P5 = emailToId['ph.hoanglan@school.local'];

  const DIRECTOR = directorId;
  const ACCOUNTING = accountingId;
  const OPS = opsId;
  const T_DEMO = teacherDemoId;
  const P_DEMO = parentDemoId;

  // ═══════════ 2. TEACHER PROFILES ═══════════
  console.log('\n📚 Seeding teacher profiles...');
  const tpCol = db.collection('teacherprofiles');
  const teacherProfiles = [
    {
      _id: oid(), userId: T1, subjects: ['Toán', 'Lý'], grades: ['6', '7', '8', '9'],
      teachingMode: 'BOTH', locations: ['Quận 1', 'Quận 3'], bio: 'GV Toán Lý 10 năm kinh nghiệm',
      yearsOfExperience: 10, pricePerSession: 300000, status: 'ACTIVE', rating: 4.8, totalReviews: 45, totalSessions: 320,
      availability: [
        { day: 'MONDAY', startTime: '08:00', endTime: '17:00' },
        { day: 'WEDNESDAY', startTime: '08:00', endTime: '17:00' },
        { day: 'FRIDAY', startTime: '08:00', endTime: '17:00' },
        { day: 'SATURDAY', startTime: '08:00', endTime: '12:00' },
      ],
      bankInfo: { bankName: 'Vietcombank', accountNumber: '1234567890', accountHolderName: 'Nguyễn Văn Anh' },
      approvedBy: DIRECTOR, approvedAt: daysAgo(60), createdAt: daysAgo(90), updatedAt: now,
    },
    {
      _id: oid(), userId: T2, subjects: ['Tiếng Anh'], grades: ['1', '2', '3', '4', '5'],
      teachingMode: 'ONLINE', locations: [], bio: 'GV Tiếng Anh chuyên dạy trẻ em, IELTS 8.0',
      yearsOfExperience: 6, pricePerSession: 250000, status: 'ACTIVE', rating: 4.9, totalReviews: 62, totalSessions: 480,
      availability: [
        { day: 'TUESDAY', startTime: '09:00', endTime: '18:00' },
        { day: 'THURSDAY', startTime: '09:00', endTime: '18:00' },
        { day: 'SATURDAY', startTime: '09:00', endTime: '15:00' },
      ],
      bankInfo: { bankName: 'Techcombank', accountNumber: '9876543210', accountHolderName: 'Trần Thị Thúy' },
      approvedBy: DIRECTOR, approvedAt: daysAgo(50), createdAt: daysAgo(80), updatedAt: now,
    },
    {
      _id: oid(), userId: T3, subjects: ['Hóa', 'Sinh'], grades: ['10', '11', '12'],
      teachingMode: 'OFFLINE', locations: ['Quận 7', 'Quận 2'], bio: 'Thạc sĩ Hóa học, luyện thi ĐH',
      yearsOfExperience: 8, pricePerSession: 350000, status: 'ACTIVE', rating: 4.6, totalReviews: 30, totalSessions: 210,
      availability: [
        { day: 'MONDAY', startTime: '14:00', endTime: '20:00' },
        { day: 'WEDNESDAY', startTime: '14:00', endTime: '20:00' },
        { day: 'SUNDAY', startTime: '08:00', endTime: '12:00' },
      ],
      bankInfo: { bankName: 'BIDV', accountNumber: '5555666677', accountHolderName: 'Lê Quang Minh' },
      approvedBy: DIRECTOR, approvedAt: daysAgo(40), createdAt: daysAgo(70), updatedAt: now,
    },
    {
      _id: oid(), userId: T4, subjects: ['Văn', 'Sử'], grades: ['8', '9', '10', '11'],
      teachingMode: 'BOTH', locations: ['Bình Thạnh', 'Phú Nhuận'], bio: 'GV Văn Sử, chuyên luyện thi vào lớp 10',
      yearsOfExperience: 5, pricePerSession: 280000, status: 'ACTIVE', rating: 4.7, totalReviews: 25, totalSessions: 150,
      availability: [
        { day: 'TUESDAY', startTime: '15:00', endTime: '21:00' },
        { day: 'THURSDAY', startTime: '15:00', endTime: '21:00' },
        { day: 'SATURDAY', startTime: '14:00', endTime: '20:00' },
      ],
      bankInfo: { bankName: 'VPBank', accountNumber: '1112223334', accountHolderName: 'Phạm Thị Lan' },
      approvedBy: DIRECTOR, approvedAt: daysAgo(30), createdAt: daysAgo(55), updatedAt: now,
    },
    {
      _id: oid(), userId: T_DEMO, subjects: ['Toán', 'Tiếng Anh'], grades: ['6', '7', '8'],
      teachingMode: 'BOTH', locations: ['Quận 1'], bio: 'Giáo viên Demo',
      yearsOfExperience: 3, pricePerSession: 200000, status: 'ACTIVE', rating: 4.5, totalReviews: 10, totalSessions: 50,
      availability: [
        { day: 'MONDAY', startTime: '08:00', endTime: '20:00' },
        { day: 'TUESDAY', startTime: '08:00', endTime: '20:00' },
        { day: 'WEDNESDAY', startTime: '08:00', endTime: '20:00' },
        { day: 'THURSDAY', startTime: '08:00', endTime: '20:00' },
        { day: 'FRIDAY', startTime: '08:00', endTime: '20:00' },
      ],
      bankInfo: { bankName: 'Vietcombank', accountNumber: '0000001111', accountHolderName: 'Giáo viên Demo' },
      approvedBy: DIRECTOR, approvedAt: daysAgo(20), createdAt: daysAgo(30), updatedAt: now,
    },
  ];
  for (const tp of teacherProfiles) {
    await tpCol.updateOne({ userId: tp.userId }, { $setOnInsert: tp }, { upsert: true });
  }
  console.log(`  ✅ ${teacherProfiles.length} teacher profiles upserted`);

  // ═══════════ 3. PRODUCTS ═══════════
  console.log('\n📦 Seeding products...');
  const prodCol = db.collection('products');
  const products = [
    { _id: ID.prod1, name: 'Gói Cơ bản (20 buổi)', code: 'PKG-BASIC', createdAt: now, updatedAt: now },
    { _id: ID.prod2, name: 'Gói Nâng cao (40 buổi)', code: 'PKG-ADV', createdAt: now, updatedAt: now },
  ];
  for (const p of products) {
    await prodCol.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
  }
  console.log('  ✅ 2 products upserted');

  // ═══════════ 4. STUDENTS ═══════════
  console.log('\n🎒 Seeding students...');
  const stuCol = db.collection('students');
  const studentDocs = [
    // Parent 1 — Nguyễn Văn Bình (2 children)
    { _id: ID.st1, studentCode: 'HS-001', fullName: 'Nguyễn Minh Khôi', age: 8, parentName: 'Nguyễn Văn Bình', parentPhone: '0901234567', parentUserId: P1, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(50), subjects: ['Toán'], grade: '3', preferredTeachingMode: 'OFFLINE', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 300000, amountCollected: 6000000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(55), updatedAt: now },
    { _id: ID.st2, studentCode: 'HS-002', fullName: 'Nguyễn Thị Hà My', age: 10, parentName: 'Nguyễn Văn Bình', parentPhone: '0901234567', parentUserId: P1, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(48), subjects: ['Tiếng Anh'], grade: '5', preferredTeachingMode: 'ONLINE', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [{ frameIndex: 1, sessionsRegistered: 15, pricePerSession: 250000, amountCollected: 3750000, sessionsCollected: 15, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(53), updatedAt: now },
    // Parent 2 — Trần Văn Cường (3 children)
    { _id: ID.st3, studentCode: 'HS-003', fullName: 'Trần Đức Anh', age: 12, parentName: 'Trần Văn Cường', parentPhone: '0902345678', parentUserId: P2, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(45), subjects: ['Toán', 'Lý'], grade: '7', preferredTeachingMode: 'BOTH', saleId: S2, saleName: 'Trần Văn Tuấn', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 300000, amountCollected: 6000000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(50), updatedAt: now },
    { _id: ID.st4, studentCode: 'HS-004', fullName: 'Trần Thị Bảo Ngọc', age: 7, parentName: 'Trần Văn Cường', parentPhone: '0902345678', parentUserId: P2, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(45), subjects: ['Tiếng Anh'], grade: '2', preferredTeachingMode: 'ONLINE', saleId: S2, saleName: 'Trần Văn Tuấn', payments: [{ frameIndex: 1, sessionsRegistered: 10, pricePerSession: 250000, amountCollected: 2500000, sessionsCollected: 10, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(50), updatedAt: now },
    { _id: ID.st5, studentCode: 'HS-005', fullName: 'Trần Quốc Huy', age: 16, parentName: 'Trần Văn Cường', parentPhone: '0902345678', parentUserId: P2, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(40), subjects: ['Hóa', 'Sinh'], grade: '11', preferredTeachingMode: 'OFFLINE', saleId: S2, saleName: 'Trần Văn Tuấn', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 350000, amountCollected: 7000000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(45), updatedAt: now },
    // Parent 3 — Lê Hoàng Nam (2 children)
    { _id: ID.st6, studentCode: 'HS-006', fullName: 'Lê Hoàng Phúc', age: 14, parentName: 'Lê Hoàng Nam', parentPhone: '0903456789', parentUserId: P3, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(35), subjects: ['Văn', 'Sử'], grade: '9', preferredTeachingMode: 'BOTH', saleId: S3, saleName: 'Lê Thị Mai', payments: [{ frameIndex: 1, sessionsRegistered: 25, pricePerSession: 280000, amountCollected: 7000000, sessionsCollected: 25, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(40), updatedAt: now },
    { _id: ID.st7, studentCode: 'HS-007', fullName: 'Lê Thị Ngọc Hân', age: 9, parentName: 'Lê Hoàng Nam', parentPhone: '0903456789', parentUserId: P3, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(35), subjects: ['Toán'], grade: '4', preferredTeachingMode: 'OFFLINE', saleId: S3, saleName: 'Lê Thị Mai', payments: [{ frameIndex: 1, sessionsRegistered: 15, pricePerSession: 300000, amountCollected: 4500000, sessionsCollected: 15, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(38), updatedAt: now },
    // Parent 4 — Phạm Văn Giang (2 children)
    { _id: ID.st8, studentCode: 'HS-008', fullName: 'Phạm Gia Bảo', age: 6, parentName: 'Phạm Văn Giang', parentPhone: '0904567890', parentUserId: P4, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(30), subjects: ['Tiếng Anh'], grade: '1', preferredTeachingMode: 'ONLINE', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [], createdAt: daysAgo(35), updatedAt: now },
    { _id: ID.st9, studentCode: 'HS-009', fullName: 'Phạm Thị Thanh Trúc', age: 15, parentName: 'Phạm Văn Giang', parentPhone: '0904567890', parentUserId: P4, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(28), subjects: ['Văn'], grade: '10', preferredTeachingMode: 'BOTH', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 280000, amountCollected: 5600000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(32), updatedAt: now },
    // Parent 5 — Hoàng Thị Lan (2 children)
    { _id: ID.st10, studentCode: 'HS-010', fullName: 'Hoàng Đức Trọng', age: 11, parentName: 'Hoàng Thị Lan', parentPhone: '0905678901', parentUserId: P5, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(25), subjects: ['Toán', 'Tiếng Anh'], grade: '6', preferredTeachingMode: 'BOTH', saleId: S2, saleName: 'Trần Văn Tuấn', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 300000, amountCollected: 6000000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(30), updatedAt: now },
    { _id: ID.st11, studentCode: 'HS-011', fullName: 'Hoàng Thị Mai Linh', age: 13, parentName: 'Hoàng Thị Lan', parentPhone: '0905678901', parentUserId: P5, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(25), subjects: ['Hóa'], grade: '8', preferredTeachingMode: 'OFFLINE', saleId: S3, saleName: 'Lê Thị Mai', payments: [{ frameIndex: 1, sessionsRegistered: 15, pricePerSession: 350000, amountCollected: 5250000, sessionsCollected: 15, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(28), updatedAt: now },
    // Demo parent children
    { _id: ID.st12, studentCode: 'HS-012', fullName: 'Demo Minh Anh', age: 10, parentName: 'Phụ huynh Demo', parentPhone: '0900000001', parentUserId: P_DEMO, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(20), subjects: ['Toán', 'Tiếng Anh'], grade: '5', preferredTeachingMode: 'BOTH', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [{ frameIndex: 1, sessionsRegistered: 20, pricePerSession: 300000, amountCollected: 6000000, sessionsCollected: 20, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(25), updatedAt: now },
    { _id: ID.st13, studentCode: 'HS-013', fullName: 'Demo Quốc Bảo', age: 8, parentName: 'Phụ huynh Demo', parentPhone: '0900000001', parentUserId: P_DEMO, faceImage: '', approvalStatus: 'APPROVED', approvedBy: OPS, approvedAt: daysAgo(20), subjects: ['Tiếng Anh'], grade: '3', preferredTeachingMode: 'ONLINE', saleId: S2, saleName: 'Trần Văn Tuấn', payments: [{ frameIndex: 1, sessionsRegistered: 10, pricePerSession: 250000, amountCollected: 2500000, sessionsCollected: 10, confirmStatus: 'CONFIRMED' }], createdAt: daysAgo(22), updatedAt: now },
    // Pending approval students
    { _id: ID.st14, studentCode: 'HS-014', fullName: 'Võ Thành Đạt', age: 7, parentName: 'Võ Minh Tuấn', parentPhone: '0906789012', faceImage: '', approvalStatus: 'PENDING', subjects: ['Toán'], grade: '2', preferredTeachingMode: 'OFFLINE', saleId: S3, saleName: 'Lê Thị Mai', payments: [], createdAt: daysAgo(5), updatedAt: now },
    { _id: ID.st15, studentCode: 'HS-015', fullName: 'Đặng Thị Ngọc Ánh', age: 17, parentName: 'Đặng Văn Hùng', parentPhone: '0907890123', faceImage: '', approvalStatus: 'PENDING', subjects: ['Hóa', 'Sinh'], grade: '12', preferredTeachingMode: 'BOTH', saleId: S1, saleName: 'Nguyễn Thị Hương', payments: [], createdAt: daysAgo(3), updatedAt: now },
  ];
  for (const s of studentDocs) {
    await stuCol.updateOne({ studentCode: s.studentCode }, { $setOnInsert: s }, { upsert: true });
  }
  // Reload student IDs
  const allStudents = await stuCol.find({ studentCode: { $in: studentDocs.map(s => s.studentCode) } }).toArray();
  const stMap = {};
  for (const s of allStudents) stMap[s.studentCode] = s._id;
  const ST = (code) => stMap[code];
  console.log(`  ✅ ${studentDocs.length} students upserted`);

  // ═══════════ 5. CLASSES ═══════════
  console.log('\n🏫 Seeding classes...');
  const classCol = db.collection('classrooms');

  const classDocs = [
    {
      _id: ID.c1, name: 'Toán 7 — Nhóm A', code: 'TOAN7-A',
      teacher: T1, sale: S1, students: [ST('HS-001'), ST('HS-003'), ST('HS-007')],
      pricePerSession: 300000, teacherPayPerSession: 180000,
      baseDuration: 60, sessionDuration: 90, status: 'ACTIVE',
      schedule: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:30' }, { day: 'WEDNESDAY', startTime: '08:00', endTime: '09:30' }],
      totalSessions: 20, sessionsCompleted: 8, startDate: daysAgo(30), description: 'Lớp Toán lớp 7 buổi sáng',
      cancelPolicy: { hoursBeforeSession: 24, lateChargePercent: 50, allowReschedule: true, maxReschedules: 2 },
      createdAt: daysAgo(30), updatedAt: now,
    },
    {
      _id: ID.c2, name: 'Tiếng Anh Trẻ em', code: 'ENG-KIDS',
      teacher: T2, sale: S2, students: [ST('HS-002'), ST('HS-004'), ST('HS-008'), ST('HS-012'), ST('HS-013')],
      pricePerSession: 250000, teacherPayPerSession: 150000,
      baseDuration: 60, sessionDuration: 60, status: 'ACTIVE',
      schedule: [{ day: 'TUESDAY', startTime: '09:00', endTime: '10:00' }, { day: 'THURSDAY', startTime: '09:00', endTime: '10:00' }],
      totalSessions: 24, sessionsCompleted: 10, startDate: daysAgo(35), description: 'Lớp Tiếng Anh online cho trẻ em',
      cancelPolicy: { hoursBeforeSession: 12, lateChargePercent: 30, allowReschedule: true, maxReschedules: 3 },
      createdAt: daysAgo(35), updatedAt: now,
    },
    {
      _id: ID.c3, name: 'Hóa 11 — Luyện thi', code: 'HOA11-LT',
      teacher: T3, sale: S2, students: [ST('HS-005'), ST('HS-011')],
      pricePerSession: 350000, teacherPayPerSession: 210000,
      baseDuration: 60, sessionDuration: 120, status: 'ACTIVE',
      schedule: [{ day: 'WEDNESDAY', startTime: '14:00', endTime: '16:00' }, { day: 'SUNDAY', startTime: '08:00', endTime: '10:00' }],
      totalSessions: 30, sessionsCompleted: 12, startDate: daysAgo(40), description: 'Lớp Hóa luyện thi ĐH 120 phút/buổi',
      createdAt: daysAgo(40), updatedAt: now,
    },
    {
      _id: ID.c4, name: 'Văn 9 — Luyện thi vào 10', code: 'VAN9-LT',
      teacher: T4, sale: S3, students: [ST('HS-006'), ST('HS-009')],
      pricePerSession: 280000, teacherPayPerSession: 170000,
      baseDuration: 60, sessionDuration: 90, status: 'ACTIVE',
      schedule: [{ day: 'TUESDAY', startTime: '15:00', endTime: '16:30' }, { day: 'SATURDAY', startTime: '14:00', endTime: '15:30' }],
      totalSessions: 20, sessionsCompleted: 6, startDate: daysAgo(20), description: 'Văn luyện thi vào lớp 10',
      createdAt: daysAgo(20), updatedAt: now,
    },
    {
      _id: ID.c5, name: 'Toán Tiếng Anh Demo', code: 'DEMO-MIX',
      teacher: T_DEMO, sale: S1, students: [ST('HS-012'), ST('HS-010')],
      pricePerSession: 200000, teacherPayPerSession: 120000,
      baseDuration: 50, sessionDuration: 70, status: 'ACTIVE',
      schedule: [{ day: 'MONDAY', startTime: '14:00', endTime: '15:10' }, { day: 'FRIDAY', startTime: '14:00', endTime: '15:10' }],
      totalSessions: 16, sessionsCompleted: 4, startDate: daysAgo(15), description: 'Lớp Demo — baseDuration 50p, buổi học 70p',
      createdAt: daysAgo(15), updatedAt: now,
    },
    {
      _id: ID.c6, name: 'Toán 6 Cơ bản', code: 'TOAN6-CB',
      teacher: T1, sale: S3, students: [ST('HS-010'), ST('HS-007')],
      pricePerSession: 250000, teacherPayPerSession: 150000,
      baseDuration: 60, sessionDuration: 60, status: 'ACTIVE',
      schedule: [{ day: 'FRIDAY', startTime: '08:00', endTime: '09:00' }],
      totalSessions: 12, sessionsCompleted: 5, startDate: daysAgo(25),
      createdAt: daysAgo(25), updatedAt: now,
    },
  ];
  for (const c of classDocs) {
    await classCol.updateOne({ code: c.code }, { $setOnInsert: c }, { upsert: true });
  }
  // Reload class IDs
  const allClasses = await classCol.find({ code: { $in: classDocs.map(c => c.code) } }).toArray();
  const classMap = {};
  for (const c of allClasses) classMap[c.code] = c._id;
  const C = (code) => classMap[code];
  console.log(`  ✅ ${classDocs.length} classes upserted`);

  // ═══════════ 6. SESSIONS ═══════════
  console.log('\n📅 Seeding sessions...');
  const sesCol = db.collection('sessions');
  const existingSes = await sesCol.countDocuments({});
  if (existingSes > 5) {
    console.log(`  ⏭️ ${existingSes} sessions already exist, skipping`);
  } else {
    const sessionDocs = [];
    let sesIdx = 0;

    // Helper to create sessions
    const mkSes = (classCode, studentCode, teacherId, parentId, date, start, end, dur, num, status, extra = {}) => {
      const ratio = dur / (classDocs.find(c => c.code === classCode)?.baseDuration || 60);
      const cls = classDocs.find(c => c.code === classCode);
      const charged = Math.round((cls?.pricePerSession || 0) * ratio);
      const payout = Math.round((cls?.teacherPayPerSession || 0) * ratio);
      sesIdx++;
      return {
        _id: oid(),
        classId: C(classCode), studentId: ST(studentCode), teacherId, parentUserId: parentId,
        scheduledDate: date, scheduledStartTime: start, scheduledEndTime: end,
        durationMinutes: dur, sessionNumber: num, status,
        amountCharged: charged, teacherPayout: payout,
        isPaid: ['FINALIZED', 'PARENT_CONFIRMED'].includes(status),
        isTeacherPaid: status === 'FINALIZED',
        confirmation: {
          ...((['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(status)) ? { teacherCompletedAt: date } : {}),
          ...((['PARENT_CONFIRMED', 'FINALIZED'].includes(status)) ? { parentConfirmedAt: new Date(date.getTime() + 3600000) } : {}),
          ...(status === 'FINALIZED' ? { finalizedAt: new Date(date.getTime() + 86400000), finalizedBy: OPS } : {}),
        },
        createdBy: OPS,
        createdAt: new Date(date.getTime() - 86400000), updatedAt: now,
        ...extra,
      };
    };

    // TOAN7-A sessions (90 min, baseDuration 60)
    for (let i = 0; i < 8; i++) {
      const d = daysAgo(28 - i * 3);
      const st = i % 3 === 0 ? 'HS-001' : i % 3 === 1 ? 'HS-003' : 'HS-007';
      const pid = i % 3 === 0 ? P1 : i % 3 === 1 ? P2 : P3;
      const status = i < 5 ? 'FINALIZED' : i < 7 ? 'PARENT_CONFIRMED' : 'TEACHER_COMPLETED';
      sessionDocs.push(mkSes('TOAN7-A', st, T1, pid, d, '08:00', '09:30', 90, i + 1, status,
        i < 5 ? { topicsCovered: `Chương ${i + 1}: Đại số`, homework: `Bài tập trang ${30 + i * 5}` } : {}
      ));
    }
    // ENG-KIDS sessions (60 min, baseDuration 60)  
    for (let i = 0; i < 10; i++) {
      const d = daysAgo(33 - i * 3);
      const students = ['HS-002', 'HS-004', 'HS-012', 'HS-013'];
      const parents = [P1, P2, P_DEMO, P_DEMO];
      const si = i % students.length;
      const status = i < 6 ? 'FINALIZED' : i < 9 ? 'PARENT_CONFIRMED' : 'SCHEDULED';
      sessionDocs.push(mkSes('ENG-KIDS', students[si], T2, parents[si], d, '09:00', '10:00', 60, i + 1, status,
        i < 6 ? { topicsCovered: `Unit ${i + 1}: Vocabulary`, homework: `Workbook page ${i + 10}`, parentRating: 4 + Math.round(Math.random()) } : {}
      ));
    }
    // HOA11-LT sessions (120 min, baseDuration 60) — HIGH VALUE
    for (let i = 0; i < 6; i++) {
      const d = daysAgo(38 - i * 5);
      const st = i % 2 === 0 ? 'HS-005' : 'HS-011';
      const pid = i % 2 === 0 ? P2 : P5;
      const status = i < 4 ? 'FINALIZED' : 'PARENT_CONFIRMED';
      sessionDocs.push(mkSes('HOA11-LT', st, T3, pid, d, '14:00', '16:00', 120, i + 1, status,
        { topicsCovered: `Bài ${i + 1}: Hóa hữu cơ`, homework: `Ôn tập chương ${i + 1}` }
      ));
    }
    // VAN9-LT sessions (90 min, baseDuration 60)
    for (let i = 0; i < 4; i++) {
      const d = daysAgo(18 - i * 4);
      const st = i % 2 === 0 ? 'HS-006' : 'HS-009';
      const pid = i % 2 === 0 ? P3 : P4;
      const status = i < 2 ? 'FINALIZED' : 'TEACHER_COMPLETED';
      sessionDocs.push(mkSes('VAN9-LT', st, T4, pid, d, '15:00', '16:30', 90, i + 1, status));
    }
    // DEMO-MIX sessions (70 min, baseDuration 50)
    for (let i = 0; i < 4; i++) {
      const d = daysAgo(13 - i * 3);
      const st = i % 2 === 0 ? 'HS-012' : 'HS-010';
      const pid = i % 2 === 0 ? P_DEMO : P5;
      const status = i < 2 ? 'FINALIZED' : i === 2 ? 'TEACHER_COMPLETED' : 'SCHEDULED';
      sessionDocs.push(mkSes('DEMO-MIX', st, T_DEMO, pid, d, '14:00', '15:10', 70, i + 1, status));
    }
    // Future scheduled sessions
    for (let i = 0; i < 3; i++) {
      const d = daysFromNow(i * 3 + 1);
      sessionDocs.push(mkSes('TOAN7-A', 'HS-001', T1, P1, d, '08:00', '09:30', 90, 9 + i, 'SCHEDULED'));
    }
    // Cancelled session
    sessionDocs.push({
      ...mkSes('ENG-KIDS', 'HS-002', T2, P1, daysAgo(10), '09:00', '10:00', 60, 11, 'CANCELLED'),
      cancellation: {
        cancelledBy: 'PARENT', cancelledByUserId: P1,
        cancelReason: 'Con bị ốm', cancelledAt: daysAgo(11),
        refundPercent: 100, refundAmount: 250000, isLateCancellation: false,
      },
    });

    // Insert all
    if (sessionDocs.length) {
      await sesCol.insertMany(sessionDocs);
    }
    console.log(`  ✅ ${sessionDocs.length} sessions inserted`);
  }

  // Reload sessions for wallet/invoice/attendance refs
  const allSessions = await sesCol.find({}).toArray();

  // ═══════════ 7. WALLETS & LEDGER ═══════════
  console.log('\n💰 Seeding wallets & ledger entries...');
  const walCol = db.collection('wallets');
  const ledCol = db.collection('ledgerentries');
  const existingWal = await walCol.countDocuments({});
  if (existingWal > 3) {
    console.log(`  ⏭️ ${existingWal} wallets already exist, skipping`);
  } else {
    const parentWallets = [
      { userId: P1, topUp: 10000000 },
      { userId: P2, topUp: 15000000 },
      { userId: P3, topUp: 12000000 },
      { userId: P4, topUp: 6000000 },
      { userId: P5, topUp: 12000000 },
      { userId: P_DEMO, topUp: 9000000 },
    ];

    for (const pw of parentWallets) {
      const walletId = oid();
      // Calculate deductions from finalized sessions for this parent
      const parentSessions = allSessions.filter(
        s => s.parentUserId?.toString() === pw.userId.toString() && ['FINALIZED', 'PARENT_CONFIRMED'].includes(s.status)
      );
      const totalDeducted = parentSessions.reduce((sum, s) => sum + (s.amountCharged || 0), 0);
      const balance = pw.topUp - totalDeducted;

      const wallet = {
        _id: walletId, userId: pw.userId, balance, totalTopUp: pw.topUp,
        totalDeducted, totalRefunded: 0, status: 'ACTIVE',
        lastTransactionAt: now, createdAt: daysAgo(50), updatedAt: now,
      };
      await walCol.updateOne({ userId: pw.userId }, { $setOnInsert: wallet }, { upsert: true });

      // Fetch actual wallet id
      const actualWallet = await walCol.findOne({ userId: pw.userId });
      const aWalletId = actualWallet._id;

      // Check if ledger already has entries
      const existingLedger = await ledCol.countDocuments({ walletId: aWalletId });
      if (existingLedger > 0) continue;

      // Top-up ledger entry
      const topUpEntry = {
        _id: oid(), walletId: aWalletId, userId: pw.userId, type: 'TOP_UP', status: 'COMPLETED',
        amount: pw.topUp, balanceBefore: 0, balanceAfter: pw.topUp,
        description: 'Nạp tiền qua chuyển khoản ngân hàng', paymentMethod: 'BANK_TRANSFER',
        transactionRef: `TU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        approvedBy: ACCOUNTING, approvedAt: daysAgo(49), createdBy: ACCOUNTING,
        createdAt: daysAgo(50), updatedAt: daysAgo(49),
      };
      await ledCol.insertOne(topUpEntry);

      // Session deduction entries
      let runningBalance = pw.topUp;
      for (const ses of parentSessions) {
        const before = runningBalance;
        runningBalance -= ses.amountCharged;
        await ledCol.insertOne({
          _id: oid(), walletId: aWalletId, userId: pw.userId, type: 'SESSION_DEDUCT', status: 'COMPLETED',
          amount: ses.amountCharged, balanceBefore: before, balanceAfter: runningBalance,
          description: `Trừ học phí buổi ${ses.sessionNumber || '?'}`,
          sessionId: ses._id, classId: ses.classId, studentId: ses.studentId,
          createdBy: OPS, createdAt: ses.scheduledDate, updatedAt: ses.scheduledDate,
        });
      }
    }
    console.log('  ✅ Wallets & ledger entries created');
  }

  // ═══════════ 8. INVOICES ═══════════
  console.log('\n🧾 Seeding invoices...');
  const invCol = db.collection('invoices');
  const existingInv = await invCol.countDocuments({});
  if (existingInv > 5) {
    console.log(`  ⏭️ ${existingInv} invoices already exist, skipping`);
  } else {
    const invoiceDocs = [
      { invoiceNumber: 'INV-2026-001', studentId: ST('HS-001'), classId: C('TOAN7-A'), sessions: 20, pricePerSession: 300000, amount: 6000000, paymentDate: daysAgo(50), status: 'PAID', description: 'Học phí Toán 7 — 20 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-002', studentId: ST('HS-002'), classId: C('ENG-KIDS'), sessions: 15, pricePerSession: 250000, amount: 3750000, paymentDate: daysAgo(48), status: 'PAID', description: 'Học phí Tiếng Anh — 15 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-003', studentId: ST('HS-003'), classId: C('TOAN7-A'), sessions: 20, pricePerSession: 300000, amount: 6000000, paymentDate: daysAgo(45), status: 'PAID', description: 'Học phí Toán 7 — 20 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-004', studentId: ST('HS-005'), classId: C('HOA11-LT'), sessions: 20, pricePerSession: 350000, amount: 7000000, paymentDate: daysAgo(40), status: 'PAID', description: 'Học phí Hóa 11 Luyện thi — 20 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-005', studentId: ST('HS-006'), classId: C('VAN9-LT'), sessions: 25, pricePerSession: 280000, amount: 7000000, paymentDate: daysAgo(35), status: 'PAID', description: 'Học phí Văn 9 Luyện thi — 25 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-006', studentId: ST('HS-012'), classId: C('DEMO-MIX'), sessions: 20, pricePerSession: 200000, amount: 4000000, paymentDate: daysAgo(22), status: 'PAID', description: 'Học phí Demo Mix — 20 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-007', studentId: ST('HS-010'), classId: C('TOAN6-CB'), sessions: 12, pricePerSession: 250000, amount: 3000000, paymentDate: daysAgo(24), status: 'PAID', description: 'Học phí Toán 6 CB — 12 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-008', studentId: ST('HS-013'), classId: C('ENG-KIDS'), sessions: 10, pricePerSession: 250000, amount: 2500000, paymentDate: daysAgo(20), status: 'PAID', description: 'Học phí Tiếng Anh — 10 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-009', studentId: ST('HS-004'), classId: C('ENG-KIDS'), sessions: 10, pricePerSession: 250000, amount: 2500000, paymentDate: daysAgo(43), status: 'PAID', description: 'Học phí Tiếng Anh — 10 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-010', studentId: ST('HS-011'), classId: C('HOA11-LT'), sessions: 15, pricePerSession: 350000, amount: 5250000, paymentDate: daysAgo(28), status: 'PAID', description: 'Học phí Hóa 11 — 15 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-011', studentId: ST('HS-009'), classId: C('VAN9-LT'), sessions: 20, pricePerSession: 280000, amount: 5600000, paymentDate: daysAgo(30), status: 'PAID', description: 'Học phí Văn 9 — 20 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-012', studentId: ST('HS-008'), classId: C('ENG-KIDS'), sessions: 10, pricePerSession: 250000, amount: 2500000, paymentDate: daysAgo(10), status: 'PENDING', description: 'Học phí Tiếng Anh — 10 buổi (chờ thanh toán)', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-013', studentId: ST('HS-007'), classId: C('TOAN6-CB'), sessions: 15, pricePerSession: 250000, amount: 3750000, paymentDate: daysAgo(8), status: 'PENDING', description: 'Học phí Toán 6 — 15 buổi (chờ TT)', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-014', studentId: ST('HS-001'), classId: C('TOAN7-A'), sessions: 10, pricePerSession: 300000, amount: 3000000, paymentDate: daysAgo(5), status: 'PENDING', description: 'Gia hạn Toán 7 — 10 buổi', createdBy: ACCOUNTING },
      { invoiceNumber: 'INV-2026-015', studentId: ST('HS-012'), classId: C('ENG-KIDS'), sessions: 10, pricePerSession: 250000, amount: 2500000, paymentDate: daysAgo(3), status: 'CANCELLED', description: 'Hủy — đã chuyển sang gói khác', createdBy: ACCOUNTING },
    ];
    for (const inv of invoiceDocs) {
      inv._id = oid();
      inv.createdAt = inv.paymentDate;
      inv.updatedAt = now;
    }
    for (const inv of invoiceDocs) {
      await invCol.updateOne({ invoiceNumber: inv.invoiceNumber }, { $setOnInsert: inv }, { upsert: true });
    }
    console.log(`  ✅ ${invoiceDocs.length} invoices upserted`);
  }

  // ═══════════ 9. ATTENDANCE ═══════════
  console.log('\n✅ Seeding attendance...');
  const attCol = db.collection('attendances');
  const existingAtt = await attCol.countDocuments({});
  if (existingAtt > 10) {
    console.log(`  ⏭️ ${existingAtt} attendance records already exist, skipping`);
  } else {
    const attDocs = [];
    // Generate attendance for finalized sessions
    const finalizedSessions = allSessions.filter(s => ['FINALIZED', 'PARENT_CONFIRMED', 'TEACHER_COMPLETED'].includes(s.status));
    for (const ses of finalizedSessions) {
      const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'EXCUSED']; // Weighted towards PRESENT
      const st = statuses[Math.floor(Math.random() * statuses.length)];
      attDocs.push({
        _id: oid(),
        classId: ses.classId, studentId: ses.studentId, teacherId: ses.teacherId,
        date: ses.scheduledDate, status: st,
        notes: st === 'LATE' ? 'Đến trễ 10 phút' : st === 'EXCUSED' ? 'Xin phép nghỉ' : '',
        attendedAt: st !== 'EXCUSED' ? ses.scheduledDate : null,
        createdAt: ses.scheduledDate, updatedAt: now,
      });
    }
    // A few ABSENT records
    attDocs.push({
      _id: oid(), classId: C('ENG-KIDS'), studentId: ST('HS-004'), teacherId: T2,
      date: daysAgo(15), status: 'ABSENT', notes: 'Không liên lạc được',
      createdAt: daysAgo(15), updatedAt: now,
    });
    attDocs.push({
      _id: oid(), classId: C('TOAN7-A'), studentId: ST('HS-003'), teacherId: T1,
      date: daysAgo(12), status: 'ABSENT', notes: 'Nghỉ không phép',
      createdAt: daysAgo(12), updatedAt: now,
    });

    if (attDocs.length) {
      await attCol.insertMany(attDocs);
    }
    console.log(`  ✅ ${attDocs.length} attendance records inserted`);
  }

  // ═══════════ 10. PAYROLL ═══════════
  console.log('\n💵 Seeding payroll...');
  const prCol = db.collection('payrolls');
  const piCol = db.collection('payrollitems');
  const existingPR = await prCol.countDocuments({});
  if (existingPR > 2) {
    console.log(`  ⏭️ ${existingPR} payroll records already exist, skipping`);
  } else {
    const periodStart = daysAgo(30);
    const periodEnd = daysAgo(1);
    const payrollDocs = [];
    const payrollItemDocs = [];

    const teacherIds = [T1, T2, T3, T4];
    const teacherNames = ['Nguyễn Văn Anh', 'Trần Thị Thúy', 'Lê Quang Minh', 'Phạm Thị Lan'];

    for (let ti = 0; ti < teacherIds.length; ti++) {
      const tid = teacherIds[ti];
      const teacherSessions = allSessions.filter(
        s => s.teacherId?.toString() === tid.toString() && s.status === 'FINALIZED'
      );

      if (!teacherSessions.length) continue;

      const gross = teacherSessions.reduce((sum, s) => sum + (s.teacherPayout || 0), 0);
      const payrollId = oid();
      const payrollCode = `PR-2026-${String(ti + 1).padStart(3, '0')}`;

      payrollDocs.push({
        _id: payrollId, teacherId: tid,
        periodStart, periodEnd, payrollCode,
        totalSessions: teacherSessions.length,
        grossAmount: gross, adjustmentAmount: 0, bonusAmount: 0, deductionAmount: 0,
        netAmount: gross, status: ti < 2 ? 'PAID' : 'APPROVED',
        createdBy: ACCOUNTING, approvedBy: DIRECTOR, approvedAt: daysAgo(1),
        paidAt: ti < 2 ? now : null, paidBy: ti < 2 ? ACCOUNTING : null,
        paymentRef: ti < 2 ? `BANK-${Date.now()}` : null,
        notes: `Lương tháng — ${teacherNames[ti]}`,
        createdAt: daysAgo(2), updatedAt: now,
      });

      for (const ses of teacherSessions) {
        payrollItemDocs.push({
          _id: oid(), payrollId, sessionId: ses._id, classId: ses.classId, studentId: ses.studentId,
          sessionDate: ses.scheduledDate, teacherPayout: ses.teacherPayout, adjustedPayout: ses.teacherPayout,
          status: 'INCLUDED', createdAt: daysAgo(2), updatedAt: now,
        });
      }
    }

    if (payrollDocs.length) await prCol.insertMany(payrollDocs);
    if (payrollItemDocs.length) await piCol.insertMany(payrollItemDocs);
    console.log(`  ✅ ${payrollDocs.length} payrolls, ${payrollItemDocs.length} payroll items inserted`);
  }

  // ═══════════ 11. LOANS (100M TEST) ═══════════
  console.log('\n💸 Seeding 100M loan test data...');
  const bankAccCol = db.collection('bankaccounts');
  const bankTxCol = db.collection('banktransactions');
  const loanCol = db.collection('loans');
  const loanPayCol = db.collection('loanpayments');

  const seedLoanCode = 'LOAN-TEST-100M';

  let bankAccount = await bankAccCol.findOne(
    { status: 'ACTIVE' },
    { sort: { isPrimary: -1, createdAt: -1 } },
  );

  if (!bankAccount) {
    const seedBankAccount = {
      _id: oid(),
      accountCode: 'BA-SEED-LOAN-001',
      bankName: 'VCB',
      accountNumber: '1000000001',
      accountHolder: 'School Demo',
      branch: 'HCM',
      currentBalance: 500_000_000,
      openingBalance: 500_000_000,
      status: 'ACTIVE',
      isPrimary: true,
      createdById: ACCOUNTING,
      createdByName: 'Ke toan Demo',
      createdAt: daysAgo(120),
      updatedAt: now,
    };
    await bankAccCol.updateOne(
      { accountCode: seedBankAccount.accountCode },
      { $setOnInsert: seedBankAccount },
      { upsert: true },
    );
    bankAccount = await bankAccCol.findOne({ accountCode: seedBankAccount.accountCode });
  }

  if (!bankAccount) {
    throw new Error('Cannot resolve ACTIVE bank account for loan seed');
  }

  const startDate = daysAgo(100);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 10);

  const loanDoc = {
    _id: oid(),
    loanCode: seedLoanCode,
    lenderName: 'Ngan hang test 100M',
    lenderType: 'BANK',
    loanType: 'WORKING_CAPITAL',
    principal: 100_000_000,
    interestRate: 12,
    interestType: 'FIXED',
    term: 10,
    startDate,
    endDate,
    paymentFrequency: 'MONTHLY',
    status: 'ACTIVE',
    bankAccountId: bankAccount._id,
    totalPaid: 16_900_000,
    remainingBalance: 85_000_000,
    collateral: 'Hop dong doanh thu demo',
    notes: 'Seed loan 100M for full-system operation test',
    createdById: DIRECTOR,
    createdByName: 'Giam doc Demo',
    approvedById: ACCOUNTING,
    approvedByName: 'Ke toan Demo',
    approvedAt: daysAgo(99),
    createdAt: daysAgo(100),
    updatedAt: now,
  };

  await loanCol.updateOne(
    { loanCode: seedLoanCode },
    { $setOnInsert: loanDoc },
    { upsert: true },
  );

  const seededLoan = await loanCol.findOne({ loanCode: seedLoanCode });
  if (!seededLoan) {
    throw new Error('Cannot find seeded 100M loan after upsert');
  }

  const paymentPlan = [
    { paymentNumber: 1, status: 'PAID', principalAmount: 10_000_000, interestAmount: 1_000_000, paidAmount: 11_000_000, paidPrincipal: 10_000_000, paidInterest: 1_000_000, paidDate: daysAgo(69) },
    { paymentNumber: 2, status: 'PARTIAL', principalAmount: 10_000_000, interestAmount: 900_000, paidAmount: 5_900_000, paidPrincipal: 5_000_000, paidInterest: 900_000, paidDate: daysAgo(38) },
    { paymentNumber: 3, status: 'OVERDUE', principalAmount: 10_000_000, interestAmount: 800_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 4, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 700_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 5, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 600_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 6, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 500_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 7, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 400_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 8, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 300_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 9, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 200_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
    { paymentNumber: 10, status: 'SCHEDULED', principalAmount: 10_000_000, interestAmount: 100_000, paidAmount: 0, paidPrincipal: 0, paidInterest: 0, paidDate: null },
  ];

  for (const p of paymentPlan) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + p.paymentNumber);
    const totalAmount = p.principalAmount + p.interestAmount;

    const paymentDoc = {
      _id: oid(),
      paymentCode: `LP-${seedLoanCode}-${String(p.paymentNumber).padStart(3, '0')}`,
      loanId: seededLoan._id,
      paymentNumber: p.paymentNumber,
      dueDate,
      paidDate: p.paidDate,
      principalAmount: p.principalAmount,
      interestAmount: p.interestAmount,
      totalAmount,
      paidAmount: p.paidAmount,
      paidPrincipal: p.paidPrincipal,
      paidInterest: p.paidInterest,
      status: p.status,
      paymentMethod: p.paidAmount > 0 ? 'BANK_TRANSFER' : undefined,
      reference: p.paidAmount > 0 ? `LOAN100M-PAY-${String(p.paymentNumber).padStart(3, '0')}` : undefined,
      notes: p.status === 'OVERDUE' ? 'Ky den han chua thanh toan' : undefined,
      paidById: p.paidAmount > 0 ? ACCOUNTING : undefined,
      paidByName: p.paidAmount > 0 ? 'Ke toan Demo' : undefined,
      createdAt: dueDate,
      updatedAt: now,
    };

    await loanPayCol.updateOne(
      { paymentCode: paymentDoc.paymentCode },
      { $setOnInsert: paymentDoc },
      { upsert: true },
    );
  }

  const openingBalance = Number(bankAccount.currentBalance || 0);
  const txDocs = [
    {
      transactionCode: 'BT-SEED-LOAN100M-001',
      bankAccountId: bankAccount._id,
      type: 'DEPOSIT',
      category: 'LOAN_DISBURSEMENT',
      amount: 100_000_000,
      balanceBefore: openingBalance,
      balanceAfter: openingBalance + 100_000_000,
      transactionDate: startDate,
      description: 'Giai ngan khoan vay test 100M',
      reference: seedLoanCode,
      referenceId: seededLoan._id,
      referenceType: 'LOAN',
      recordedById: ACCOUNTING,
      recordedByName: 'Ke toan Demo',
      isReconciled: true,
      reconciledAt: now,
      reconciledByName: 'Ke toan Demo',
      createdAt: startDate,
      updatedAt: now,
    },
    {
      transactionCode: 'BT-SEED-LOAN100M-002',
      bankAccountId: bankAccount._id,
      type: 'WITHDRAWAL',
      category: 'LOAN_REPAYMENT',
      amount: 11_000_000,
      balanceBefore: openingBalance + 100_000_000,
      balanceAfter: openingBalance + 89_000_000,
      transactionDate: daysAgo(69),
      description: 'Tra no ky 1 - LOAN-TEST-100M',
      reference: seedLoanCode,
      referenceId: seededLoan._id,
      referenceType: 'LOAN',
      recordedById: ACCOUNTING,
      recordedByName: 'Ke toan Demo',
      isReconciled: true,
      reconciledAt: now,
      reconciledByName: 'Ke toan Demo',
      createdAt: daysAgo(69),
      updatedAt: now,
    },
    {
      transactionCode: 'BT-SEED-LOAN100M-003',
      bankAccountId: bankAccount._id,
      type: 'WITHDRAWAL',
      category: 'LOAN_REPAYMENT',
      amount: 5_900_000,
      balanceBefore: openingBalance + 89_000_000,
      balanceAfter: openingBalance + 83_100_000,
      transactionDate: daysAgo(38),
      description: 'Tra no ky 2 (partial) - LOAN-TEST-100M',
      reference: seedLoanCode,
      referenceId: seededLoan._id,
      referenceType: 'LOAN',
      recordedById: ACCOUNTING,
      recordedByName: 'Ke toan Demo',
      isReconciled: true,
      reconciledAt: now,
      reconciledByName: 'Ke toan Demo',
      createdAt: daysAgo(38),
      updatedAt: now,
    },
  ];

  let netSeedDelta = 0;
  for (const tx of txDocs) {
    const upsertTx = await bankTxCol.updateOne(
      { transactionCode: tx.transactionCode },
      { $setOnInsert: { _id: oid(), ...tx } },
      { upsert: true },
    );
    if (upsertTx.upsertedCount > 0) {
      netSeedDelta += tx.type === 'WITHDRAWAL' ? -tx.amount : tx.amount;
    }
  }

  if (netSeedDelta !== 0) {
    await bankAccCol.updateOne(
      { _id: bankAccount._id },
      { $inc: { currentBalance: netSeedDelta }, $set: { updatedAt: now } },
    );
  }

  console.log('  ✅ Loan test 100M + payments + bank transactions upserted');

  // 12. TICKETS
  console.log('\n🎫 Seeding tickets...');
  const tkCol = db.collection('tickets');
  const existingTk = await tkCol.countDocuments({});
  if (existingTk > 2) {
    console.log(`  ⏭️ ${existingTk} tickets already exist, skipping`);
  } else {
    const ticketDocs = [
      {
        _id: oid(), ticketCode: 'TK-001', type: 'PAYMENT_ISSUE', status: 'RESOLVED', priority: 'HIGH',
        subject: 'Nạp tiền chưa được cộng số dư', description: 'Đã chuyển khoản 5.000.000đ nhưng ví chưa được cộng tiền sau 2 ngày.',
        createdBy: P1, createdByRole: 'PARENT',
        assignedTo: ACCOUNTING, assignedAt: daysAgo(13),
        resolution: { summary: 'Đã kiểm tra và cộng tiền thành công', outcome: 'APPROVED', resolvedBy: ACCOUNTING, resolvedAt: daysAgo(12) },
        createdAt: daysAgo(14), updatedAt: daysAgo(12),
      },
      {
        _id: oid(), ticketCode: 'TK-002', type: 'SCHEDULE_ISSUE', status: 'IN_PROGRESS', priority: 'MEDIUM',
        subject: 'Xin đổi lịch học từ T3 sang T5', description: 'Con có lịch học thêm vào thứ 3, xin chuyển sang thứ 5 cùng giờ.',
        createdBy: P2, createdByRole: 'PARENT', classId: C('ENG-KIDS'), studentId: ST('HS-004'),
        assignedTo: OPS, assignedAt: daysAgo(4),
        createdAt: daysAgo(5), updatedAt: daysAgo(4),
      },
      {
        _id: oid(), ticketCode: 'TK-003', type: 'TEACHER_COMPLAINT', status: 'OPEN', priority: 'LOW',
        subject: 'GV đến trễ 15 phút', description: 'Buổi học ngày 01/02 giáo viên đến trễ 15 phút, con phải chờ.',
        createdBy: P3, createdByRole: 'PARENT', teacherId: T4, classId: C('VAN9-LT'), studentId: ST('HS-006'),
        createdAt: daysAgo(3), updatedAt: daysAgo(3),
      },
      {
        _id: oid(), ticketCode: 'TK-004', type: 'REFUND_REQUEST', status: 'WAITING_INFO', priority: 'HIGH',
        subject: 'Yêu cầu hoàn tiền 3 buổi chưa học', description: 'Con chuyển trường, không tiếp tục học được. Xin hoàn tiền 3 buổi còn lại.',
        createdBy: P5, createdByRole: 'PARENT', classId: C('HOA11-LT'), studentId: ST('HS-011'),
        assignedTo: ACCOUNTING, assignedAt: daysAgo(1),
        createdAt: daysAgo(2), updatedAt: daysAgo(1),
      },
      {
        _id: oid(), ticketCode: 'TK-005', type: 'OTHER', status: 'OPEN', priority: 'MEDIUM',
        subject: 'Xin cấp lại hóa đơn tháng 1', description: 'Hóa đơn tháng 1 bị thất lạc, xin cấp lại bản in.',
        createdBy: P4, createdByRole: 'PARENT',
        createdAt: daysAgo(1), updatedAt: daysAgo(1),
      },
    ];
    await tkCol.insertMany(ticketDocs);
    console.log(`  ✅ ${ticketDocs.length} tickets inserted`);
  }

  // ═══════════ SUMMARY ═══════════
  console.log('\n══════════════════════════════════════');
  console.log('🎉 Seed hoàn tất! Tóm tắt dữ liệu:');
  console.log('══════════════════════════════════════');
  const counts = {
    users: await db.collection('users').countDocuments({}),
    teacherprofiles: await db.collection('teacherprofiles').countDocuments({}),
    students: await db.collection('students').countDocuments({}),
    products: await db.collection('products').countDocuments({}),
    classrooms: await db.collection('classrooms').countDocuments({}),
    sessions: await db.collection('sessions').countDocuments({}),
    bankaccounts: await db.collection('bankaccounts').countDocuments({}),
    banktransactions: await db.collection('banktransactions').countDocuments({}),
    loans: await db.collection('loans').countDocuments({}),
    loanpayments: await db.collection('loanpayments').countDocuments({}),
    wallets: await db.collection('wallets').countDocuments({}),
    ledgerentries: await db.collection('ledgerentries').countDocuments({}),
    invoices: await db.collection('invoices').countDocuments({}),
    attendances: await db.collection('attendances').countDocuments({}),
    payrolls: await db.collection('payrolls').countDocuments({}),
    payrollitems: await db.collection('payrollitems').countDocuments({}),
    tickets: await db.collection('tickets').countDocuments({}),
  };
  for (const [col, count] of Object.entries(counts)) {
    console.log(`  📊 ${col}: ${count}`);
  }

  console.log('\n🔑 Tài khoản đăng nhập (password: ' + PASSWORD + ')');
  console.log('  • director.demo@school.local  (DIRECTOR — Giám đốc)');
  console.log('  • accounting.demo@school.local (ACCOUNTING — Kế toán)');
  console.log('  • ops.demo@school.local        (OPS — Vận hành)');
  console.log('  • teacher.demo@school.local    (TEACHER — Giáo viên)');
  console.log('  • parent.demo@school.local     (PARENT — Phụ huynh)');
  console.log('  • Tất cả GV/Sale/PH mới: password cùng là ' + PASSWORD);

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

