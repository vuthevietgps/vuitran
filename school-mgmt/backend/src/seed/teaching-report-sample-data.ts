/**
 * DỮ LIỆU MẪU CHO CHỨC NĂNG BÁO CÁO GIẢNG DẠY
 * 
 * File này chứa dữ liệu mẫu để:
 * - Test chức năng báo cáo giảng dạy
 * - Demo cho người dùng
 * - Seed database trong môi trường development
 */

// ============================================================
// 1. TEACHING REPORT SUBMISSIONS (Báo cáo GV nộp)
// ============================================================

export const sampleTeachingReports = [
  {
    sessionId: '65abc123def456789',
    lessonContent: 'Ôn tập bảng cửu chương 7, 8, 9. Luyện tập phép chia có dư. Bài tập nâng cao về toán tư duy với các bài toán đố.',
    studentAttitude: 'Học sinh tập trung, hào hứng trong giờ học. Tương tác tốt với giáo viên. Em đặt nhiều câu hỏi hay.',
    recordingUrl: 'https://meet.google.com/rec/abc123xyz',
    teacherComment: 'Em đã tiến bộ rõ rệt trong tuần này. Khả năng nhẩm tính nhanh hơn trước. Cần ôn thêm phép chia.',
    homework: 'Làm bài tập SGK trang 45-46. Luyện bảng cửu chương 8 thuộc lòng. Làm 10 bài toán nâng cao.',
    additionalNotes: 'Phụ huynh nên cho em ôn thêm phép chia tại nhà. Em có thể học trước bài mới tuần sau.'
  },
  {
    sessionId: '65abc123def456790',
    lessonContent: 'Học từ vựng tiếng Anh chủ đề Animals (động vật). Luyện phát âm và đọc đơn từ. Chơi game nhớ từ.',
    studentAttitude: 'Em rất hứng thú với chủ đề động vật. Phát âm chuẩn, nhớ từ nhanh.',
    recordingUrl: 'https://zoom.us/rec/share/xyz789',
    teacherComment: 'Em có khả năng nghe tốt. Cần luyện thêm kỹ năng nói.',
    homework: 'Học thuộc 20 từ vựng về động vật. Xem video Mickey Mouse bằng tiếng Anh.',
    additionalNotes: 'Khuyến khích em nói tiếng Anh tại nhà.'
  },
  {
    sessionId: '65abc123def456791',
    lessonContent: 'Luyện đọc hiểu văn bản "Bài ca chú ve con". Phân tích nhân vật, hoàn cảnh. Tập làm văn tả cây.',
    studentAttitude: 'Em đọc rất hay, giọng rõ ràng. Phân tích nhân vật sâu sắc.',
    recordingUrl: '',
    teacherComment: 'Em có khiếu văn học. Nên khuyến khích em viết nhật ký hàng ngày.',
    homework: 'Viết đoạn văn tả một loại cây em thích (150 từ). Đọc thêm 2 truyện ngắn.',
    additionalNotes: 'Em có thể tham gia câu lạc bộ văn học của trường.'
  },
  {
    sessionId: '65abc123def456792',
    lessonContent: 'Học vẽ tranh phong cảnh bằng màu nước. Kỹ thuật pha màu, đánh bóng, tạo độ sâu.',
    studentAttitude: 'Em rất kiên nhẫn và tỉ mỉ. Có óc thẩm mỹ tốt.',
    recordingUrl: 'https://meet.google.com/rec/art001',
    teacherComment: 'Bức tranh của em đẹp, cảm nhận màu sắc tốt. Cần luyện thêm kỹ thuật tạo bóng.',
    homework: 'Vẽ 1 bức tranh phong cảnh theo ý thích. Tìm hiểu về họa sĩ Van Gogh.',
    additionalNotes: 'Nên cho em tham quan triển lãm nghệ thuật.'
  },
  {
    sessionId: '65abc123def456793',
    lessonContent: 'Học lập trình Scratch: Tạo game "Bắt táo rơi". Sử dụng sprite, biến, điều kiện if-else.',
    studentAttitude: 'Em rất hứng thú, tự nghĩ ra nhiều tính năng mới cho game.',
    recordingUrl: 'https://zoom.us/rec/code123',
    teacherComment: 'Em có tư duy logic tốt. Khả năng giải quyết vấn đề xuất sắc.',
    homework: 'Hoàn thiện game và thêm âm thanh. Làm thêm 1 game đơn giản khác.',
    additionalNotes: 'Em có thể học thêm Python trong tương lai.'
  }
];

// ============================================================
// 2. ATTENDANCE RECORDS (Dữ liệu điểm danh)
// ============================================================

// ============================================================
// 2. ATTENDANCE RECORDS (Dữ liệu điểm danh - KHÔNG chứa salary)
// Salary được theo dõi riêng trong PayrollTransactions
// ============================================================

export const sampleAttendanceRecords = [
  {
    _id: '65abc123def456789',
    date: new Date('2026-02-08T00:00:00.000Z'),
    attendedAt: new Date('2026-02-08T09:30:00.000Z'),
    status: 'COMPLETED',
    sessionDuration: 90,
    sessionContent: 'Ôn tập bảng cửu chương 7, 8, 9. Luyện tập phép chia có dư.',
    comment: 'Em đã tiến bộ rõ rệt trong tuần này',
    recordLink: 'https://meet.google.com/rec/abc123xyz',
    parentConfirm: 'OK',
    imageUrl: 'https://storage.school.vn/attendance/20260208_093000_HS2024001.jpg',
    notes: '',
    sessionIndex: 15,
    studentId: {
      _id: '65student123',
      studentCode: 'HS2024001',
      fullName: 'Nguyễn Văn An'
    },
    classId: {
      _id: '65class123',
      name: 'Toán Tư Duy Cấp Độ 1',
      code: 'MATH01',
      classType: 'ONLINE'
    },
    teacherId: {
      _id: '65teacher123',
      fullName: 'Trần Thị Bình',
      email: 'binh.teacher@school.vn'
    }
  },
  {
    _id: '65abc123def456790',
    date: new Date('2026-02-07T00:00:00.000Z'),
    attendedAt: new Date('2026-02-07T14:00:00.000Z'),
    status: 'COMPLETED',
    sessionDuration: 60,
    sessionContent: 'Học từ vựng tiếng Anh chủ đề Animals',
    comment: 'Em có khả năng nghe tốt',
    recordLink: 'https://zoom.us/rec/share/xyz789',
    parentConfirm: 'OK',
    imageUrl: 'https://storage.school.vn/attendance/20260207_140000_HS2024002.jpg',
    notes: '',
    sessionIndex: 12,
    studentId: {
      _id: '65student124',
      studentCode: 'HS2024002',
      fullName: 'Lê Thị Bảo'
    },
    classId: {
      _id: '65class124',
      name: 'English for Kids Level 2',
      code: 'ENG02',
      classType: 'ONLINE'
    },
    teacherId: {
      _id: '65teacher124',
      fullName: 'Phạm Văn Cường',
      email: 'cuong.teacher@school.vn'
    }
  },
  {
    _id: '65abc123def456791',
    date: new Date('2026-02-06T00:00:00.000Z'),
    attendedAt: new Date('2026-02-06T16:30:00.000Z'),
    status: 'COMPLETED',
    sessionDuration: 90,
    sessionContent: 'Luyện đọc hiểu văn bản "Bài ca chú ve con"',
    comment: 'Em có khiếu văn học',
    recordLink: '',
    parentConfirm: 'PENDING',
    imageUrl: 'https://storage.school.vn/attendance/20260206_163000_HS2024003.jpg',
    notes: '',
    sessionIndex: 8,
    studentId: {
      _id: '65student125',
      studentCode: 'HS2024003',
      fullName: 'Hoàng Minh Châu'
    },
    classId: {
      _id: '65class125',
      name: 'Văn Học Thiếu Nhi',
      code: 'LIT01',
      classType: 'OFFLINE'
    },
    teacherId: {
      _id: '65teacher125',
      fullName: 'Nguyễn Thị Dung',
      email: 'dung.teacher@school.vn'
    }
  },
  {
    _id: '65abc123def456792',
    date: new Date('2026-02-05T00:00:00.000Z'),
    attendedAt: new Date('2026-02-05T10:00:00.000Z'),
    status: 'COMPLETED',
    sessionDuration: 120,
    sessionContent: 'Học vẽ tranh phong cảnh bằng màu nước',
    comment: 'Bức tranh của em đẹp, cảm nhận màu sắc tốt',
    recordLink: 'https://meet.google.com/rec/art001',
    parentConfirm: 'OK',
    imageUrl: 'https://storage.school.vn/attendance/20260205_100000_HS2024004.jpg',
    notes: '',
    sessionIndex: 6,
    studentId: {
      _id: '65student126',
      studentCode: 'HS2024004',
      fullName: 'Trần Quốc Duy'
    },
    classId: {
      _id: '65class126',
      name: 'Mỹ Thuật Thiếu Nhi',
      code: 'ART01',
      classType: 'OFFLINE'
    },
    teacherId: {
      _id: '65teacher126',
      fullName: 'Lê Văn Em',
      email: 'em.teacher@school.vn'
    }
  },
  {
    _id: '65abc123def456793',
    date: new Date('2026-02-04T00:00:00.000Z'),
    attendedAt: new Date('2026-02-04T15:00:00.000Z'),
    status: 'COMPLETED',
    sessionDuration: 90,
    sessionContent: 'Học lập trình Scratch: Tạo game "Bắt táo rơi"',
    comment: 'Em có tư duy logic tốt',
    recordLink: 'https://zoom.us/rec/code123',
    parentConfirm: 'OK',
    imageUrl: 'https://storage.school.vn/attendance/20260204_150000_HS2024005.jpg',
    notes: '',
    sessionIndex: 10,
    studentId: {
      _id: '65student127',
      studentCode: 'HS2024005',
      fullName: 'Vũ Ngọc Phương'
    },
    classId: {
      _id: '65class127',
      name: 'Lập Trình Scratch Nâng Cao',
      code: 'CODE01',
      classType: 'ONLINE'
    },
    teacherId: {
      _id: '65teacher127',
      fullName: 'Đỗ Thị Giang',
      email: 'giang.teacher@school.vn'
    }
  }
];

// ============================================================
// 2B. PAYROLL TRANSACTIONS (Sổ phụ tính lương - SINGLE SOURCE OF TRUTH)
// Tách riêng khỏi Attendance để đảm bảo Single Source of Truth
// ============================================================

export const samplePayrollTransactions = [
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
  },
  {
    teacherId: '65teacher126',
    sessionId: '65abc123def456792',
    classId: '65class126',
    studentId: '65student126',
    sessionDate: new Date('2026-02-05T00:00:00.000Z'),
    baseSalary: 200000,
    penaltyAmount: 0,
    bonusAmount: 0,
    adjustmentAmount: 0,
    finalSalary: 200000,
    status: 'PENDING',
    isLateReport: false
  },
  {
    teacherId: '65teacher127',
    sessionId: '65abc123def456793',
    classId: '65class127',
    studentId: '65student127',
    sessionDate: new Date('2026-02-04T00:00:00.000Z'),
    baseSalary: 150000,
    penaltyAmount: 0,
    bonusAmount: 0,
    adjustmentAmount: 0,
    finalSalary: 150000,
    status: 'PENDING',
    isLateReport: false
  }
];

// ============================================================
// 3. MONTHLY REPORT DATA (Tổng hợp theo tháng)
// ============================================================

export const sampleMonthlyReport = {
  year: 2026,
  months: [
    {
      month: 2,
      rows: [
        // Tổng cộng 45 buổi học trong tháng 2
        ...generateMockRows(45, 2, 2026)
      ]
    },
    {
      month: 1,
      rows: [
        // Tổng cộng 38 buổi học trong tháng 1
        ...generateMockRows(38, 1, 2026)
      ]
    }
  ]
};

// ============================================================
// 4. TEACHER STATISTICS (Thống kê giáo viên)
// ============================================================

export const sampleTeacherStats = [
  {
    teacherId: '65teacher123',
    teacherName: 'Trần Thị Bình',
    teacherCode: 'GV001',
    email: 'binh.teacher@school.vn',
    stats: {
      totalSessions: 45,
      completedSessions: 43,
      reportedSessions: 42,
      onTimeReports: 38,
      lateReports: 4,
      submissionRate: 97.7, // %
      onTimeRate: 90.5, // %
      totalSalary: 6450000,
      paidSalary: 2100000,
      unpaidSalary: 4350000,
      avgSessionDuration: 85,
      avgReportLength: 245,
      hasRecordingRate: 85.7,
      parentConfirmRate: 92.9
    }
  },
  {
    teacherId: '65teacher124',
    teacherName: 'Phạm Văn Cường',
    teacherCode: 'GV002',
    email: 'cuong.teacher@school.vn',
    stats: {
      totalSessions: 38,
      completedSessions: 38,
      reportedSessions: 36,
      onTimeReports: 35,
      lateReports: 1,
      submissionRate: 94.7,
      onTimeRate: 97.2,
      totalSalary: 3800000,
      paidSalary: 3800000,
      unpaidSalary: 0,
      avgSessionDuration: 60,
      avgReportLength: 180,
      hasRecordingRate: 100,
      parentConfirmRate: 100
    }
  },
  {
    teacherId: '65teacher125',
    teacherName: 'Nguyễn Thị Dung',
    teacherCode: 'GV003',
    email: 'dung.teacher@school.vn',
    stats: {
      totalSessions: 32,
      completedSessions: 30,
      reportedSessions: 28,
      onTimeReports: 25,
      lateReports: 3,
      submissionRate: 93.3,
      onTimeRate: 89.3,
      totalSalary: 5400000,
      paidSalary: 1800000,
      unpaidSalary: 3600000,
      avgSessionDuration: 90,
      avgReportLength: 320,
      hasRecordingRate: 45.2,
      parentConfirmRate: 87.1
    }
  }
];

// ============================================================
// 5. SYSTEM METRICS (Chỉ số hệ thống)
// ============================================================

export const sampleSystemMetrics = {
  period: {
    startDate: '2026-01-01',
    endDate: '2026-02-08'
  },
  overview: {
    totalTeachers: 15,
    activeteachers: 12,
    totalSessions: 428,
    completedSessions: 405,
    reportedSessions: 387,
    submissionRate: 95.6, // %
    onTimeRate: 91.2, // %
    avgTimeToSubmit: 14.5, // hours
    totalSalary: 64650000,
    paidSalary: 28900000,
    unpaidSalary: 35750000
  },
  quality: {
    avgReportLength: 248,
    hasRecordingRate: 76.8,
    parentConfirmRate: 93.3,
    lateReportRate: 8.8
  },
  performance: {
    avgLoadTime: 1250, // ms
    avgApiResponseTime: 185, // ms
    errorRate: 0.5 // %
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateMockRows(count: number, month: number, year: number): any[] {
  const rows: any[] = [];
  const teachers = [
    { id: '65teacher123', name: 'Trần Thị Bình', code: 'GV001', email: 'binh.teacher@school.vn' },
    { id: '65teacher124', name: 'Phạm Văn Cường', code: 'GV002', email: 'cuong.teacher@school.vn' },
    { id: '65teacher125', name: 'Nguyễn Thị Dung', code: 'GV003', email: 'dung.teacher@school.vn' },
    { id: '65teacher126', name: 'Lê Văn Em', code: 'GV004', email: 'em.teacher@school.vn' },
    { id: '65teacher127', name: 'Đỗ Thị Giang', code: 'GV005', email: 'giang.teacher@school.vn' }
  ];
  
  const students = [
    { code: 'HS2024001', name: 'Nguyễn Văn An' },
    { code: 'HS2024002', name: 'Lê Thị Bảo' },
    { code: 'HS2024003', name: 'Hoàng Minh Châu' },
    { code: 'HS2024004', name: 'Trần Quốc Duy' },
    { code: 'HS2024005', name: 'Vũ Ngọc Phương' },
    { code: 'HS2024006', name: 'Phạm Thị Hà' },
    { code: 'HS2024007', name: 'Ngô Văn Khôi' }
  ];
  
  const classes = [
    { code: 'MATH01', name: 'Toán Tư Duy Cấp Độ 1' },
    { code: 'ENG02', name: 'English for Kids Level 2' },
    { code: 'LIT01', name: 'Văn Học Thiếu Nhi' },
    { code: 'ART01', name: 'Mỹ Thuật Thiếu Nhi' },
    { code: 'CODE01', name: 'Lập Trình Scratch Nâng Cao' }
  ];
  
  const lessonContents = [
    'Ôn tập bảng cửu chương. Luyện phép tính nhẩm.',
    'Học từ vựng mới. Luyện phát âm và đọc.',
    'Đọc hiểu văn bản. Phân tích nhân vật.',
    'Vẽ tranh phong cảnh. Kỹ thuật pha màu.',
    'Lập trình game đơn giản. Sử dụng biến và vòng lặp.'
  ];
  
  const comments = [
    'Em đã tiến bộ rõ rệt',
    'Em rất hào hứng trong giờ học',
    'Cần ôn thêm ở nhà',
    'Em làm bài tốt',
    'Hay đặt câu hỏi, tư duy tốt'
  ];
  
  const durations = [60, 70, 90, 120];

  for (let i = 0; i < count; i++) {
    const day = Math.floor(Math.random() * 28) + 1;
    const hour = Math.floor(Math.random() * 12) + 8;
    const minute = Math.random() < 0.5 ? 0 : 30;

    const date = new Date(year, month - 1, day, hour, minute);
    const teacher = teachers[Math.floor(Math.random() * teachers.length)];
    const student = students[Math.floor(Math.random() * students.length)];
    const classInfo = classes[Math.floor(Math.random() * classes.length)];
    const duration = durations[Math.floor(Math.random() * durations.length)];

    // NOTE: salary và paymentStatus đã được chuyển sang PayrollTransaction
    // Attendance chỉ chứa thông tin điểm danh, không chứa thông tin lương
    rows.push({
      rowId: `mock_${year}${month}_${i}`,
      index: i + 1,
      attendanceDate: date,
      attendanceDateStr: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      attendanceTimeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      studentName: student.name,
      studentCode: student.code,
      teacherCode: teacher.code,
      classCode: classInfo.code,
      className: classInfo.name,
      sessionIndex: Math.floor(Math.random() * 20) + 1,
      sessionContent: lessonContents[Math.floor(Math.random() * lessonContents.length)],
      comment: comments[Math.floor(Math.random() * comments.length)],
      duration,
      recordLink: Math.random() < 0.7 ? 'https://meet.google.com/rec/xyz' : '',
      imageUrl: `https://storage.school.vn/attendance/${year}${month}${day}_${student.code}.jpg`,
      parentConfirm: Math.random() < 0.9 ? 'OK' : 'PENDING',
      checkedBy: Math.random() < 0.5 ? 'manager01' : '',
      notes: ''
    });
  }
  
  return rows.sort((a, b) => b.attendanceDate.getTime() - a.attendanceDate.getTime());
}

// ============================================================
// EXPORT FOR SEED SCRIPT
// ============================================================

export default {
  teachingReports: sampleTeachingReports,
  attendanceRecords: sampleAttendanceRecords,
  payrollTransactions: samplePayrollTransactions,
  monthlyReport: sampleMonthlyReport,
  teacherStats: sampleTeacherStats,
  systemMetrics: sampleSystemMetrics
};
