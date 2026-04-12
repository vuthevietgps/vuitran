# PHÂN TÍCH CHỨC NĂNG BÁO CÁO GIẢNG DẠY

## 📊 TỔNG QUAN CHỨC NĂNG

Chức năng **Báo cáo giảng dạy** (Teaching Report) là một tính năng quan trọng trong hệ thống quản lý trường học, cho phép:
- Giáo viên nộp báo cáo sau mỗi buổi học
- Quản lý theo dõi tiến độ giảng dạy
- Cơ sở để tính lương giáo viên
- Phụ huynh xem được chất lượng buổi học

---

## 🎯 CÁC THÀNH PHẦN CHÍNH

### 1. Backend API (NestJS)

#### 1.1. Sessions Service
**File**: `backend/src/sessions/sessions.service.ts`

```typescript
async submitTeachingReport(
  sessionId: string,
  teacherUserId: string,
  dto: SubmitTeachingReportDto,
): Promise<SessionDocument>
```

**Chức năng**:
- Giáo viên nộp/cập nhật báo cáo giảng dạy
- Validate quyền (chỉ GV của buổi học mới được nộp)
- Không cho phép nộp báo cáo cho buổi đã hủy
- Đánh dấu `hasTeachingReport = true`

#### 1.2. Attendance Service  
**File**: `backend/src/attendance/attendance.service.ts`

```typescript
async getAttendanceReport(
  startDate: string, 
  endDate: string, 
  classId?: string
)
```

**Chức năng**:
- Lấy danh sách điểm danh theo khoảng thời gian
- Tích hợp thông tin lương giáo viên
- Populate thông tin học sinh, lớp học, giáo viên

### 2. Frontend Component (Angular)

**File**: `frontend/src/app/components/teaching-report.component.ts`

**Giao diện hiển thị**:
- Bộ lọc theo giáo viên, năm, khoảng thời gian
- Nhóm dữ liệu theo năm → tháng
- Bảng chi tiết từng buổi học
- Inline editing cho các trường văn bản
- Tổng hợp lương chưa thanh toán / đã thanh toán

**Các trường dữ liệu trong báo cáo**:
1. STT
2. Mã giáo viên
3. Thời gian điểm danh (giờ + ngày)
4. Học viên (mã + tên)
5. Mã lớp (code + name)
6. Buổi số (sessionIndex)
7. Nội dung buổi học (sessionContent) - **editable**
8. Nhận xét (comment) - **editable**
9. Thời lượng (duration)
10. Hình ảnh điểm danh (imageUrl)
11. Lương GV (salary)
12. Link record (recordLink) - **editable**
13. Xác nhận phụ huynh (parentConfirm)
14. Trung tâm check lương (paymentStatus)
15. Người Check (checkedBy)
16. Ghi chú (notes) - **editable**

---

## 📦 DỮ LIỆU MẪU

### Mẫu 1: DTO Nộp Báo Cáo Giảng Dạy

```json
{
  "lessonContent": "Ôn tập bảng cửu chương 7, 8, 9. Luyện tập phép chia có dư. Bài tập nâng cao về toán tư duy.",
  "studentAttitude": "Học sinh tập trung, hào hứng trong giờ học. Tương tác tốt với giáo viên.",
  "recordingUrl": "https://meet.google.com/rec/abc123xyz",
  "teacherComment": "Em đã tiến bộ rõ rệt trong tuần này. Khả năng nhẩm tính nhanh hơn trước.",
  "homework": "Làm bài tập SGK trang 45-46. Luyện bảng cửu chương 8 thuộc lòng.",
  "additionalNotes": "Phụ huynh nên cho em ôn thêm phép chia tại nhà."
}
```

### Mẫu 2: Response Báo Cáo Tổng Hợp

```json
{
  "_id": "65abc123def456789",
  "date": "2026-02-08T00:00:00.000Z",
  "attendedAt": "2026-02-08T09:30:00.000Z",
  "status": "COMPLETED",
  "sessionDuration": 90,
  "salaryAmount": 150000,
  "sessionContent": "Ôn tập bảng cửu chương 7, 8, 9. Luyện tập phép chia có dư.",
  "comment": "Em đã tiến bộ rõ rệt trong tuần này",
  "recordLink": "https://meet.google.com/rec/abc123xyz",
  "parentConfirm": "OK",
  "paymentStatus": 0,
  "studentId": {
    "_id": "65student123",
    "studentCode": "HS2024001",
    "fullName": "Nguyễn Văn An"
  },
  "classId": {
    "_id": "65class123",
    "name": "Toán Tư Duy Cấp Độ 1",
    "code": "MATH01",
    "classType": "ONLINE"
  },
  "teacherId": {
    "_id": "65teacher123",
    "fullName": "Trần Thị Bình",
    "email": "binh.teacher@school.vn"
  },
  "notes": "",
  "sessionIndex": 15
}
```

### Mẫu 3: ReportRow (Frontend Display)

```typescript
{
  rowId: '65abc123def456789',
  index: 1,
  attendanceDate: new Date('2026-02-08'),
  attendanceDateStr: '08/02/2026',
  attendanceTimeStr: '09:30',
  studentName: 'Nguyễn Văn An',
  studentCode: 'HS2024001',
  teacherCode: 'GV001',
  classCode: 'MATH01',
  className: 'Toán Tư Duy Cấp Độ 1',
  sessionIndex: 15,
  sessionContent: 'Ôn tập bảng cửu chương 7, 8, 9',
  comment: 'Em đã tiến bộ rõ rệt',
  duration: 90,
  salary: 150000,
  recordLink: 'https://meet.google.com/rec/abc123xyz',
  imageUrl: 'https://storage.school.vn/attendance/img123.jpg',
  parentConfirm: 'OK',
  paymentStatus: 0, // 0=UNPAID, 1=PAID
  checkedBy: 'manager01',
  notes: ''
}
```

### Mẫu 4: Dữ liệu Tổng Hợp Theo Tháng

```typescript
{
  year: 2026,
  months: [
    {
      month: 2, // Tháng 2
      rows: [
        // 45 buổi học trong tháng 2/2026
        { rowId: '...', index: 1, attendanceDateStr: '01/02/2026', salary: 120000, ... },
        { rowId: '...', index: 2, attendanceDateStr: '01/02/2026', salary: 150000, ... },
        // ... 43 rows khác
      ]
    },
    {
      month: 1, // Tháng 1
      rows: [
        // 38 buổi học trong tháng 1/2026
        { rowId: '...', index: 1, attendanceDateStr: '05/01/2026', salary: 100000, ... },
        // ... 37 rows khác
      ]
    }
  ]
}
```

---

## 💪 ĐIỂM MẠNH

### 1. **Kiến trúc Rõ Ràng**
✅ Tách biệt rõ ràng giữa Sessions (buổi học) và Attendance (điểm danh)  
✅ Backend có validation chặt chẽ quyền truy cập  
✅ Frontend sử dụng Angular Signals - reactive và hiệu năng cao

### 2. **Bảo Mật & Quyền Hạn**
✅ Chỉ giáo viên được phân công mới nộp được báo cáo  
✅ Không cho phép nộp báo cáo cho buổi học đã hủy/dời lịch  
✅ Vai trò HCNS/MANAGER/DIRECTOR mới được check lương

### 3. **Tính Năng Toàn Diện**
✅ Inline editing - người dùng có thể sửa trực tiếp trên bảng  
✅ Tự động nhóm theo năm/tháng - dễ quản lý  
✅ Tích hợp tính lương - báo cáo là cơ sở để thanh toán  
✅ Xác nhận phụ huynh - minh bạch chất lượng  

### 4. **Trải Nghiệm Người Dùng**
✅ Bộ lọc đa dạng: theo giáo viên, năm, khoảng thời gian  
✅ Hiển thị tổng lương chưa thanh toán/đã thanh toán ngay đầu trang  
✅ Responsive design với dark theme chuyên nghiệp

### 5. **Tính Linh Hoạt**
✅ Có thể nộp/cập nhật báo cáo bất cứ lúc nào  
✅ Không bắt buộc tất cả các trường (chỉ lessonContent là required)  
✅ Hỗ trợ cả lớp ONLINE và OFFLINE

### 6. **Audit Trail**
✅ Lưu thời gian nộp báo cáo (submittedAt)  
✅ Tracking người check lương (checkedBy)  
✅ Lịch sử thay đổi trạng thái thanh toán

---

## ⚠️ ĐIỂM YẾU & CẦN CẢI THIỆN

### 1. **Logic Nghiệp Vụ Chưa Chặt Chẽ**

#### ❌ Vấn đề: Thiếu workflow rõ ràng
```
HIỆN TẠI: 
- GV có thể nộp báo cáo bất cứ lúc nào
- Không có deadline cụ thể
- Không có cảnh báo nếu GV quên nộp

CẢI THIỆN:
- Thêm deadline nộp báo cáo (VD: trong vòng 24h sau buổi học)
- Gửi thông báo nhắc nhở GV chưa nộp báo cáo
- Đánh dấu "late report" nếu nộp muộn
```

#### ❌ Vấn đề: Tính lương không rõ ràng
```typescript
// Code hiện tại
const salary = item.salaryAmount ?? 
  this.computeSalaryForSession(cls, item.teacherId?._id, item.sessionDuration);

VẤNĐỀ:
- Logic tính lương nằm rải rác ở nhiều nơi
- Không có công thức chuẩn hóa
- Thiếu kiểm tra hasTeachingReport = true khi tính lương

CẢI THIỆN:
- Tập trung logic tính lương vào một service riêng
- Bắt buộc: salary = 0 nếu hasTeachingReport = false
- Lưu version công thức tính lương để audit
```

### 2. **Frontend Performance Issues**

#### ❌ Vấn đề: Render toàn bộ data
```typescript
// Hiện tại load tất cả attendance trong năm
async reload() {
  const { startDate, endDate } = this.getCurrentYearRange();
  const data = await this.attendanceService.getAttendanceReport(
    startDate, endDate, undefined
  );
  this.attendance.set(data); // Có thể hàng ngàn records
}

CẢI THIỆN:
- Implement pagination
- Lazy loading khi scroll
- Virtual scrolling cho bảng lớn
- Cache data đã load
```

#### ❌ Vấn đề: Inline editing không tối ưu
```html
<textarea [ngModel]="r.sessionContent" 
  (ngModelChange)="updateField(r.rowId,'sessionContent',$event)">
</textarea>

VẤNĐỀ:
- Mỗi lần gõ 1 ký tự đều trigger change
- Không có debounce
- Gửi API quá nhiều lần

CẢI THIỆN:
- Debounce 500ms
- Batch multiple updates
- Hiển thị trạng thái saving/saved
```

### 3. **Validation Thiếu**

#### ❌ Backend
```typescript
export class SubmitTeachingReportDto {
  @IsString()
  @IsNotEmpty()
  lessonContent!: string; // Chỉ validate không empty, chưa validate length
  
  @IsOptional()
  recordingUrl?: string; // Không validate format URL
}

CẢI THIỆN:
@IsString()
@IsNotEmpty()
@MinLength(20, { message: 'Nội dung học phải ít nhất 20 ký tự' })
@MaxLength(2000)
lessonContent!: string;

@IsOptional()
@IsUrl({}, { message: 'Link record không hợp lệ' })
recordingUrl?: string;
```

#### ❌ Frontend
```typescript
// Không có validation trước khi submit
async submitReport(sessionId: string) {
  if (!this.reportForm.lessonContent?.trim()) return; // Quá đơn giản
  // ...
}

CẢI THIỆN:
- Validate độ dài tối thiểu
- Validate format URL
- Hiển thị lỗi cụ thể cho người dùng
- Prevent submit khi đang saving
```

### 4. **Thiếu Tính Năng Quan Trọng**

#### ❌ Không có template báo cáo
```
HIỆNTẠI: GV phải tự gõ từ đầu mỗi lần

CẢI THIỆN:
- Template có sẵn theo môn học
- Copy từ buổi học trước
- Gợi ý nội dung dựa trên curriculum
```

#### ❌ Không có báo cáo thống kê
```
THIẾU:
- GV đã nộp bao nhiêu báo cáo trong tháng?
- Tỷ lệ nộp đúng hạn?
- Báo cáo nào chưa được xác nhận bởi phụ huynh?
- Lương trung bình/tháng của GV?

CẢI THIỆN:
- Thêm dashboard thống kê cho GV
- Thêm dashboard cho quản lý theo dõi chất lượng báo cáo
```

#### ❌ Không có notification
```
THIẾU:
- Thông báo khi GV nộp báo cáo → PH
- Thông báo khi PH xác nhận → GV
- Thông báo khi lương được duyệt → GV

CẢI THIỆN:
- Implement WebSocket/SSE cho real-time notification
- Email notification cho các sự kiện quan trọng
```

### 5. **Data Consistency**

#### ❌ Vấn đề: Dữ liệu từ 2 nguồn khác nhau
```typescript
// Sessions có teachingReport
async submitTeachingReport(...) {
  session.teachingReport = { ... };
  session.hasTeachingReport = true;
}

// Nhưng báo cáo lại query từ Attendance
async getAttendanceReport(...) {
  return this.attendanceModel.find(...)
    .populate('studentId', ...)
}

VẤNĐỀ:
- Sessions.teachingReport không được hiển thị trong report
- Attendance không có trường teachingReport
- Dữ liệu không đồng bộ

CẢI THIỆN:
- Quyết định 1 single source of truth
- Đồng bộ dữ liệu giữa Sessions và Attendance
- Hoặc merge data khi query
```

### 6. **Error Handling Yếu**

```typescript
// Frontend
async loadReport() {
  try {
    const data = await this.attendanceService.getAttendanceReport(...);
    this.attendance.set(data);
  } catch (e: any) {
    this.error.set(e?.message || 'Lỗi tải báo cáo'); // Generic error
  }
}

CẢI THIỆN:
- Phân loại lỗi cụ thể (network, permission, validation)
- Retry logic cho network errors
- Fallback UI khi load thất bại
- Sentry/Logger integration
```

### 7. **Security Concerns**

#### ❌ XSS Risk
```html
<!-- Hiển thị user input trực tiếp -->
<td>{{ r.sessionContent || '-' }}</td>
<td>{{ r.comment || '-' }}</td>

CẢI THIỆN:
- Sanitize user input
- Implement Content Security Policy
- Validate trên cả frontend và backend
```

#### ❌ Authorization không đầy đủ
```typescript
// Chỉ check ở API endpoint
@Get('report')
getAttendanceReport(...)

CẢI THIỆN:
- Thêm field-level permission (VD: chỉ HCNS mới xem được salary)
- Row-level security (GV chỉ xem báo cáo của mình)
- Audit log cho các thao tác nhạy cảm
```

### 8. **Mobile Experience**

```
VẤNĐỀ:
- Bảng quá nhiều cột không responsive
- Inline editing khó dùng trên mobile
- Không có mobile-specific UI

CẢI THIỆN:
- Card view cho mobile
- Bottom sheet cho editing
- Touch-optimized controls
```

---

## 🎯 KHUYẾN NGHỊ ƯU TIÊN

### Priority 1 (Critical) - Trong 1 Sprint

1. **Fix tính lương**: Bắt buộc `hasTeachingReport = true` để tính lương
2. **Validation đầy đủ**: MinLength, MaxLength, URL format
3. **Debounce inline editing**: Tránh spam API
4. **Error handling**: Phân loại và hiển thị lỗi cụ thể

### Priority 2 (High) - Trong 2 Sprints

5. **Pagination/Virtual scrolling**: Cải thiện performance
6. **Deadline & reminder**: Workflow rõ ràng hơn
7. **Data consistency**: Đồng bộ Sessions và Attendance
8. **Basic statistics**: Dashboard cho GV và quản lý

### Priority 3 (Medium) - Trong 3-4 Sprints

9. **Template system**: Tăng năng suất GV
10. **Notification**: Real-time updates
11. **Mobile optimization**: Responsive design
12. **Advanced analytics**: Insights về chất lượng giảng dạy

---

## 📈 METRIC ĐỀ XUẤT

Để đo lường hiệu quả chức năng:

```typescript
interface TeachingReportMetrics {
  // Tỷ lệ nộp báo cáo
  submissionRate: number; // % buổi học có báo cáo
  onTimeRate: number;     // % báo cáo nộp đúng hạn
  
  // Chất lượng báo cáo
  avgReportLength: number;        // Độ dài trung bình (chars)
  hasRecordingRate: number;       // % có link recording
  parentConfirmRate: number;      // % được PH xác nhận
  
  // Performance
  avgTimeToSubmit: number;        // Thời gian TB từ kết thúc buổi học đến nộp báo cáo
  avgLoadTime: number;            // Thời gian load trang (ms)
  
  // Business
  salaryProcessingTime: number;   // Thời gian từ nộp báo cáo đến duyệt lương
  totalSalaryPending: number;     // Tổng lương chưa thanh toán
}
```

---

## 🔍 TÓM TẮT

### ✅ Điểm Mạnh Nổi Bật
1. Kiến trúc phân tầng tốt, dễ maintain
2. Bảo mật cơ bản đầy đủ
3. UX tốt với inline editing và grupoing thông minh
4. Tích hợp tính lương trực tiếp

### ❌ Điểm Yếu Chính
1. **Logic nghiệp vụ**: Thiếu workflow rõ ràng, deadline, reminder
2. **Performance**: Chưa pagination, debounce
3. **Validation**: Quá đơn giản, thiếu nhiều rule
4. **Data consistency**: Dữ liệu từ nhiều nguồn không đồng bộ
5. **Features**: Thiếu template, statistics, notification

### 🎯 Kết Luận
Chức năng hiện tại **đáp ứng được 70% nhu cầu cơ bản**, nhưng cần cải thiện đáng kể về:
- Tính chặt chẽ của business logic
- Performance và scalability  
- User experience (đặc biệt mobile)
- Tính năng hỗ trợ (template, statistics)

**Khuyến nghị**: Ưu tiên fix các vấn đề Priority 1 ngay, sau đó triển khai từng bước theo roadmap 3 tháng.
