/**
 * SCRIPT SEED DỮ LIỆU MẪU CHO CHỨC NĂNG BÁO CÁO GIẢNG DẠY
 * 
 * Cách sử dụng:
 * cd school-mgmt/backend
 * npx ts-node scripts/seed-teaching-reports.ts
 */

import { connect, connection } from 'mongoose';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import sample data
const sampleData = {
  students: [
    { _id: '65student123', studentCode: 'HS2024001', fullName: 'Nguyễn Văn An', age: 8, parentName: 'Nguyễn Văn Anh', parentPhone: '0901234567' },
    { _id: '65student124', studentCode: 'HS2024002', fullName: 'Lê Thị Bảo', age: 9, parentName: 'Lê Văn Bình', parentPhone: '0902345678' },
    { _id: '65student125', studentCode: 'HS2024003', fullName: 'Hoàng Minh Châu', age: 10, parentName: 'Hoàng Văn Cường', parentPhone: '0903456789' },
    { _id: '65student126', studentCode: 'HS2024004', fullName: 'Trần Quốc Duy', age: 8, parentName: 'Trần Thị Duyên', parentPhone: '0904567890' },
    { _id: '65student127', studentCode: 'HS2024005', fullName: 'Vũ Ngọc Phương', age: 11, parentName: 'Vũ Văn Phúc', parentPhone: '0905678901' },
  ],
  
  teachers: [
    { _id: '65teacher123', fullName: 'Trần Thị Bình', email: 'binh.teacher@school.vn', role: 'TEACHER' },
    { _id: '65teacher124', fullName: 'Phạm Văn Cường', email: 'cuong.teacher@school.vn', role: 'TEACHER' },
    { _id: '65teacher125', fullName: 'Nguyễn Thị Dung', email: 'dung.teacher@school.vn', role: 'TEACHER' },
    { _id: '65teacher126', fullName: 'Lê Văn Em', email: 'em.teacher@school.vn', role: 'TEACHER' },
    { _id: '65teacher127', fullName: 'Đỗ Thị Giang', email: 'giang.teacher@school.vn', role: 'TEACHER' },
  ],
  
  classes: [
    { _id: '65class123', name: 'Toán Tư Duy Cấp Độ 1', code: 'MATH01', classType: 'ONLINE' },
    { _id: '65class124', name: 'English for Kids Level 2', code: 'ENG02', classType: 'ONLINE' },
    { _id: '65class125', name: 'Văn Học Thiếu Nhi', code: 'LIT01', classType: 'OFFLINE' },
    { _id: '65class126', name: 'Mỹ Thuật Thiếu Nhi', code: 'ART01', classType: 'OFFLINE' },
    { _id: '65class127', name: 'Lập Trình Scratch Nâng Cao', code: 'CODE01', classType: 'ONLINE' },
  ],
  
  sessions: [
    {
      _id: '65abc123def456789',
      classId: '65class123',
      teacherId: '65teacher123',
      studentId: '65student123',
      scheduledDate: new Date('2026-02-08T09:00:00.000Z'),
      durationMinutes: 90,
      sessionType: 'REGULAR',
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Ôn tập bảng cửu chương 7, 8, 9. Luyện tập phép chia có dư. Bài tập nâng cao về toán tư duy.',
        studentAttitude: 'Học sinh tập trung, hào hứng trong giờ học. Tương tác tốt với giáo viên.',
        recordingUrl: 'https://meet.google.com/rec/abc123xyz',
        teacherComment: 'Em đã tiến bộ rõ rệt trong tuần này. Khả năng nhẩm tính nhanh hơn trước.',
        homework: 'Làm bài tập SGK trang 45-46. Luyện bảng cửu chương 8 thuộc lòng.',
        additionalNotes: 'Phụ huynh nên cho em ôn thêm phép chia tại nhà.',
        submittedAt: new Date('2026-02-08T11:30:00.000Z')
      }
    },
    {
      _id: '65abc123def456790',
      classId: '65class124',
      teacherId: '65teacher124',
      studentId: '65student124',
      scheduledDate: new Date('2026-02-07T14:00:00.000Z'),
      durationMinutes: 60,
      sessionType: 'REGULAR',
      status: 'PARENT_CONFIRMED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Học từ vựng tiếng Anh chủ đề Animals (động vật). Luyện phát âm và đọc đơn từ.',
        studentAttitude: 'Em rất hứng thú với chủ đề động vật. Phát âm chuẩn, nhớ từ nhanh.',
        recordingUrl: 'https://zoom.us/rec/share/xyz789',
        teacherComment: 'Em có khả năng nghe tốt. Cần luyện thêm kỹ năng nói.',
        homework: 'Học thuộc 20 từ vựng về động vật. Xem video Mickey Mouse bằng tiếng Anh.',
        additionalNotes: 'Khuyến khích em nói tiếng Anh tại nhà.',
        submittedAt: new Date('2026-02-07T15:15:00.000Z')
      }
    },
    {
      _id: '65abc123def456791',
      classId: '65class125',
      teacherId: '65teacher125',
      studentId: '65student125',
      scheduledDate: new Date('2026-02-06T16:30:00.000Z'),
      durationMinutes: 90,
      sessionType: 'REGULAR',
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: true,
      teachingReport: {
        lessonContent: 'Luyện đọc hiểu văn bản "Bài ca chú ve con". Phân tích nhân vật, hoàn cảnh.',
        studentAttitude: 'Em đọc rất hay, giọng rõ ràng. Phân tích nhân vật sâu sắc.',
        recordingUrl: '',
        teacherComment: 'Em có khiếu văn học. Nên khuyến khích em viết nhật ký hàng ngày.',
        homework: 'Viết đoạn văn tả một loại cây em thích (150 từ). Đọc thêm 2 truyện ngắn.',
        additionalNotes: 'Em có thể tham gia câu lạc bộ văn học của trường.',
        submittedAt: new Date('2026-02-06T19:00:00.000Z')
      }
    }
  ],
  
  attendance: [
    {
      _id: '65abc123def456789',
      studentId: '65student123',
      classId: '65class123',
      teacherId: '65teacher123',
      date: new Date('2026-02-08T00:00:00.000Z'),
      attendedAt: new Date('2026-02-08T09:30:00.000Z'),
      status: 'PRESENT',
      sessionDuration: 90,
      sessionContent: 'Ôn tập bảng cửu chương 7, 8, 9',
      comment: 'Em đã tiến bộ rõ rệt',
      recordLink: 'https://meet.google.com/rec/abc123xyz',
      parentConfirm: 'OK',
      imageUrl: 'https://storage.school.vn/attendance/20260208_093000_HS2024001.jpg',
      sessionIndex: 15
    },
    {
      _id: '65abc123def456790',
      studentId: '65student124',
      classId: '65class124',
      teacherId: '65teacher124',
      date: new Date('2026-02-07T00:00:00.000Z'),
      attendedAt: new Date('2026-02-07T14:00:00.000Z'),
      status: 'PRESENT',
      sessionDuration: 60,
      sessionContent: 'Học từ vựng tiếng Anh chủ đề Animals',
      comment: 'Em có khả năng nghe tốt',
      recordLink: 'https://zoom.us/rec/share/xyz789',
      parentConfirm: 'OK',
      imageUrl: 'https://storage.school.vn/attendance/20260207_140000_HS2024002.jpg',
      sessionIndex: 12
    },
    {
      _id: '65abc123def456791',
      studentId: '65student125',
      classId: '65class125',
      teacherId: '65teacher125',
      date: new Date('2026-02-06T00:00:00.000Z'),
      attendedAt: new Date('2026-02-06T16:30:00.000Z'),
      status: 'PRESENT',
      sessionDuration: 90,
      sessionContent: 'Luyện đọc hiểu văn bản "Bài ca chú ve con"',
      comment: 'Em có khiếu văn học',
      recordLink: '',
      parentConfirm: 'PENDING',
      imageUrl: 'https://storage.school.vn/attendance/20260206_163000_HS2024003.jpg',
      sessionIndex: 8
    }
  ],

  // PayrollTransactions - Sổ phụ tính lương (Single Source of Truth cho salary)
  payrollTransactions: [
    {
      teacherId: '65teacher123',
      sessionId: '65abc123def456789',
      classId: '65class123',
      studentId: '65student123',
      sessionDate: new Date('2026-02-08T00:00:00.000Z'),
      baseSalary: 150000,
      penaltyAmount: 0,
      bonusAmount: 0,
      adjustmentAmount: 0,
      finalSalary: 150000,
      status: 'PENDING',
      isLateReport: false
    },
    {
      teacherId: '65teacher124',
      sessionId: '65abc123def456790',
      classId: '65class124',
      studentId: '65student124',
      sessionDate: new Date('2026-02-07T00:00:00.000Z'),
      baseSalary: 100000,
      penaltyAmount: 0,
      bonusAmount: 0,
      adjustmentAmount: 0,
      finalSalary: 100000,
      status: 'PAID',
      isLateReport: false
    },
    {
      teacherId: '65teacher125',
      sessionId: '65abc123def456791',
      classId: '65class125',
      studentId: '65student125',
      sessionDate: new Date('2026-02-06T00:00:00.000Z'),
      baseSalary: 180000,
      penaltyAmount: 0,
      bonusAmount: 0,
      adjustmentAmount: 0,
      finalSalary: 180000,
      status: 'PENDING',
      isLateReport: false
    }
  ]
};

async function seedData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
    console.log('🔌 Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get collections
    const Student = connection.collection('students');
    const User = connection.collection('users');
    const Class = connection.collection('classes');
    const Session = connection.collection('sessions');
    const Attendance = connection.collection('attendances');
    const PayrollTransaction = connection.collection('payrolltransactions');

    // Clear existing sample data (optional - uncomment if needed)
    // console.log('🗑️  Clearing existing sample data...');
    // await Student.deleteMany({ studentCode: { $in: ['HS2024001', 'HS2024002', 'HS2024003', 'HS2024004', 'HS2024005'] } });
    // await User.deleteMany({ email: { $regex: '@school.vn$' } });
    // await Class.deleteMany({ code: { $in: ['MATH01', 'ENG02', 'LIT01', 'ART01', 'CODE01'] } });

    // Insert students
    console.log('📚 Inserting students...');
    await Student.insertMany(sampleData.students);
    console.log(`✅ Inserted ${sampleData.students.length} students`);

    // Insert teachers (as users)
    console.log('👨‍🏫 Inserting teachers...');
    await User.insertMany(sampleData.teachers);
    console.log(`✅ Inserted ${sampleData.teachers.length} teachers`);

    // Insert classes
    console.log('🏫 Inserting classes...');
    await Class.insertMany(sampleData.classes);
    console.log(`✅ Inserted ${sampleData.classes.length} classes`);

    // Insert sessions
    console.log('📅 Inserting sessions with teaching reports...');
    await Session.insertMany(sampleData.sessions);
    console.log(`✅ Inserted ${sampleData.sessions.length} sessions`);

    // Insert attendance (WITHOUT salary fields - clean data)
    console.log('✍️ Inserting attendance records (without salary fields)...');
    await Attendance.insertMany(sampleData.attendance);
    console.log(`✅ Inserted ${sampleData.attendance.length} attendance records`);

    // Insert payroll transactions (SINGLE SOURCE OF TRUTH for salary)
    console.log('💰 Inserting payroll transactions (salary data)...');
    await PayrollTransaction.insertMany(sampleData.payrollTransactions);
    console.log(`✅ Inserted ${sampleData.payrollTransactions.length} payroll transactions`);

    console.log('\n🎉 SEED SUCCESSFUL!');
    console.log('\n📊 Summary:');
    console.log(`   - Students: ${sampleData.students.length}`);
    console.log(`   - Teachers: ${sampleData.teachers.length}`);
    console.log(`   - Classes: ${sampleData.classes.length}`);
    console.log(`   - Sessions: ${sampleData.sessions.length}`);
    console.log(`   - Attendance: ${sampleData.attendance.length}`);
    console.log(`   - PayrollTransactions: ${sampleData.payrollTransactions.length}`);
    console.log('\n💡 Note: Salary data is now stored in PayrollTransactions collection');
    console.log('         Attendance records no longer contain salary/paymentStatus fields');
    console.log('\n💡 Next steps:');
    console.log('   1. Login as a teacher (e.g., binh.teacher@school.vn)');
    console.log('   2. Navigate to Teaching Report page');
    console.log('   3. View and test the teaching report functionality');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    // Close connection
    await connection.close();
    console.log('\n🔌 Connection closed');
  }
}

// Run the seed script
seedData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
