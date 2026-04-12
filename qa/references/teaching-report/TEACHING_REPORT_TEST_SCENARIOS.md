# 🧪 TEST SCENARIOS - TEACHING REPORT FEATURE

## I. FUNCTIONAL TESTING

### ✅ Test Case 1: Submit Teaching Report - Happy Path

**Preconditions:**
- User logged in as TEACHER
- Session exists with `teacherId = user.sub`
- Session status = TEACHER_COMPLETED/PARENT_CONFIRMED/FINALIZED
- Session NOT (CANCELLED/RESCHEDULED)

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "lessonContent": "Chương 3: Phân số - Bài 1: Khái niệm phân số. Giới thiệu phân số qua ví dụ thực tế, phân biệt tử số và mẫu số, cách đọc và viết phân số.",
  "studentAttitude": "Học sinh tích cực, chú ý lắng nghe. Tham gia trả lời câu hỏi nhiệt tình.",
  "recordingUrl": "https://drive.google.com/file/d/abc123/view",
  "teacherComment": "Em học tốt, tiếp thu nhanh. Nên làm thêm bài tập về nhà để củng cố.",
  "homework": "SGK trang 45, bài 1-3. SBT trang 28, bài 1-5.",
  "additionalNotes": "Phụ huynh có thể xem video ghi hình để theo dõi chi tiết."
}
```

**Expected Result:**
- HTTP 200 OK
- Response body:
```json
{
  "_id": "session_id",
  "hasTeachingReport": true,
  "teachingReport": {
    "lessonContent": "...",
    "studentAttitude": "...",
    "recordingUrl": "...",
    "teacherComment": "...",
    "homework": "...",
    "additionalNotes": "...",
    "submittedAt": "2026-02-14T10:30:00.000Z"
  }
}
```
- `hasTeachingReport` flag set to `true`
- `submittedAt` is current timestamp (server-set)

---

### ✅ Test Case 2: Submit Minimal Report (Only lessonContent)

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "lessonContent": "Unit 5: Grammar - Present Perfect Tense. Exercises 1-10 from workbook."
}
```

**Expected Result:**
- HTTP 200 OK
- Report saved with only `lessonContent` and `submittedAt`
- Other fields are `null`/`undefined`

---

### ❌ Test Case 3: Submit Report Without lessonContent

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "studentAttitude": "Học sinh học tập tốt"
}
```

**Expected Result:**
- HTTP 400 Bad Request
- Error: `"lessonContent should not be empty"`

---

### ❌ Test Case 4: Teacher Submits Report for Another Teacher's Session

**Preconditions:**
- Logged in as TEACHER_A (userId = "teacher_a")
- Session.teacherId = "teacher_b" (different teacher)

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "lessonContent": "Trying to submit for another teacher's session"
}
```

**Expected Result:**
- HTTP 403 Forbidden
- Error: `"Bạn không phải GV của buổi học này"`

---

### ❌ Test Case 5: Submit Report for CANCELLED Session

**Preconditions:**
- Session.status = CANCELLED

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "lessonContent": "Content for cancelled session"
}
```

**Expected Result:**
- HTTP 400 Bad Request
- Error: `"Không thể nộp báo cáo cho buổi học đã hủy hoặc dời lịch"`

---

### ❌ Test Case 6: Submit Report for RESCHEDULED Session

**Preconditions:**
- Session.status = RESCHEDULED

**Expected Result:**
- HTTP 400 Bad Request
- Error: `"Không thể nộp báo cáo cho buổi học đã hủy hoặc dời lịch"`

---

### ✅ Test Case 7: Update Existing Report

**Preconditions:**
- Session already has `hasTeachingReport = true`
- Existing report has `lessonContent = "Old content"`

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "lessonContent": "Updated lesson content with more details",
  "teacherComment": "Added new comment after parent feedback"
}
```

**Expected Result:**
- HTTP 200 OK
- Report is **UPDATED** (not duplicated)
- `submittedAt` is updated to new timestamp
- Old content is **OVERWRITTEN** (no history kept)

---

### ❌ Test Case 8: Non-Teacher Role Attempts to Submit

**Preconditions:**
- Logged in as PARENT/STUDENT/DIRECTOR

**Expected Result:**
- HTTP 403 Forbidden
- Error: `"Chỉ giáo viên mới có thể nộp báo cáo giảng dạy"`
- (Handled by `@Roles(UserRole.TEACHER)` guard)

---

### ✅ Test Case 9: Submit Report for SCHEDULED Session (No Status Check)

**Preconditions:**
- Session.status = SCHEDULED
- Session.scheduledDate = 2026-02-20 (future date)

**Steps:**
```http
PATCH /sessions/:sessionId/teaching-report
{
  "lessonContent": "Pre-filled report before teaching"
}
```

**Expected Result:**
- ⚠️ **CURRENT BEHAVIOR**: HTTP 200 OK (report accepted)
- ⚠️ **ISSUE**: Report can be submitted BEFORE session is taught
- 💡 **RECOMMENDATION**: Should block if status = SCHEDULED or scheduledDate > now

---

## II. INTEGRATION TESTING

### Test Case 10: Payroll Integration - Sessions with Reports

**Preconditions:**
- Create 3 sessions for Teacher_A in Feb 2026:
  - Session 1: FINALIZED, `hasTeachingReport = true`, teacherPayout = 200k
  - Session 2: FINALIZED, `hasTeachingReport = true`, teacherPayout = 300k
  - Session 3: FINALIZED, `hasTeachingReport = false`, teacherPayout = 150k ← NO REPORT

**Steps:**
1. Call `sessionsService.countFinalizedForPayroll(teacherId, from, to)`

**Expected Result:**
```javascript
{
  count: 2,  // ← Only sessions 1 & 2 (session 3 excluded)
  totalPayout: 500000  // 200k + 300k
}
```

**Verification:**
- Session 3 is NOT included in payroll despite being FINALIZED
- `hasTeachingReport: true` filter is MANDATORY

---

### Test Case 11: Query Pending Reports

**Steps:**
```http
GET /sessions/my-sessions/pending-report?teacherId=teacher_xyz
```

**Expected Result:**
- Returns only sessions where:
  - `teacherId = teacher_xyz`
  - `hasTeachingReport = false`
  - `status IN (TEACHER_COMPLETED, PARENT_CONFIRMED, FINALIZED)`
- Does NOT include SCHEDULED/CANCELLED/RESCHEDULED sessions

---

### Test Case 12: Parent Views Report After Submission

**Preconditions:**
- Teacher submits report for session_123
- Parent is logged in

**Steps:**
```http
GET /sessions/:sessionId
Authorization: Bearer <parent_token>
```

**Expected Result:**
- Response includes full `teachingReport` object
- Parent can see all 6 fields (lessonContent, attitude, comment, homework, etc.)
- Parent can access `recordingUrl` if provided

---

## III. PERFORMANCE TESTING

### Test Case 13: Query Performance with Index

**Setup:**
- Insert 10,000 sessions
- 5,000 sessions have `hasTeachingReport = true`
- 5,000 sessions have `hasTeachingReport = false`

**Query:**
```javascript
db.sessions.find({
  teacherId: ObjectId("teacher_x"),
  hasTeachingReport: false,
  status: { $in: ["TEACHER_COMPLETED", "PARENT_CONFIRMED", "FINALIZED"] }
})
```

**Expected:**
- Query uses index: `{ teacherId: 1, hasTeachingReport: 1, status: 1 }`
- Execution time < 50ms
- No COLLSCAN (collection scan)

**Verification:**
```javascript
db.sessions.find(...).explain("executionStats")
// Should show:
// - "stage": "IXSCAN" (index scan)
// - "indexName": "teacherId_1_hasTeachingReport_1_status_1"
```

---

## IV. EDGE CASES & ERROR HANDLING

### Test Case 14: Submit Report with Invalid recordingUrl

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "Valid content",
  "recordingUrl": "not-a-valid-url"
}
```

**Current Behavior:**
- ✅ Accepted (no URL validation)

**Recommended Behavior:**
- ❌ Reject with `"recordingUrl must be a valid URL"`
- Add DTO validation: `@IsUrl()` decorator

---

### Test Case 15: Submit Report with Very Short lessonContent

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "abc"  // ← Only 3 characters
}
```

**Current Behavior:**
- ✅ Accepted (passes `@IsNotEmpty()` validation)

**Recommended Behavior:**
- ❌ Reject with `"lessonContent must be at least 50 characters"`
- Add DTO validation: `@MinLength(50)`

---

### Test Case 16: Session Not Found

**Steps:**
```http
PATCH /sessions/invalid_session_id/teaching-report
{
  "lessonContent": "Content"
}
```

**Expected Result:**
- HTTP 404 Not Found
- Error: `"Session không tồn tại"`

---

### Test Case 17: Submit Report 30 Days After Session Finalized

**Preconditions:**
- Session.confirmation.finalizedAt = 2026-01-01
- Current date = 2026-01-31

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "Very late submission"
}
```

**Current Behavior:**
- ✅ Accepted (no deadline validation)

**Recommended Behavior:**
- ⚠️ Warning: `"Báo cáo nộp muộn 30 ngày"`
- ❌ Reject if > 7 days late (configurable)

---

## V. SECURITY TESTING

### Test Case 18: SQL Injection Attempt

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "'; DROP TABLE sessions; --"
}
```

**Expected Result:**
- HTTP 200 OK
- Content is safely escaped (MongoDB handles this automatically)
- No SQL execution (using NoSQL)

---

### Test Case 19: XSS Injection in teacherComment

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "Normal content",
  "teacherComment": "<script>alert('XSS')</script>"
}
```

**Expected Result:**
- HTTP 200 OK
- Content stored as-is in database
- ⚠️ Frontend MUST sanitize before rendering (not tested here)

---

### Test Case 20: Excessive Payload Size

**Steps:**
```http
PATCH /sessions/:id/teaching-report
{
  "lessonContent": "A".repeat(1000000)  // 1MB of text
}
```

**Expected Result:**
- HTTP 413 Payload Too Large
- OR HTTP 400 with validation error: `"lessonContent must be less than 10,000 characters"`
- Add DTO validation: `@MaxLength(10000)`

---

## VI. REGRESSION TESTING

### Test Case 21: Session Finalization Doesn't Require Report

**Verification:**
- Confirm that sessions can be finalized WITHOUT having a teaching report
- `hasTeachingReport` is independent of session lifecycle
- Report can be submitted AFTER finalization

---

### Test Case 22: Deleting Session with Report

**Steps:**
1. Create session with teaching report
2. Attempt to delete session (if delete endpoint exists)

**Expected Behavior:**
- Either CASCADE delete (report deleted with session)
- OR RESTRICT (cannot delete session with report)
- Recommendation: SOFT DELETE (set `isDeleted = true`)

---

## VII. USABILITY TESTING

### Test Case 23: Teacher Sees Pending Reports Dashboard

**Steps:**
1. Login as TEACHER
2. Navigate to dashboard
3. Check "Pending Teaching Reports" widget

**Expected:**
- Widget shows count of sessions WITHOUT reports
- Click widget → Navigate to list of pending sessions
- Each row shows: Student name, Class, Scheduled date, Status
- CTA button: "Nộp báo cáo"

---

### Test Case 24: Notification After Report Submission

**Steps:**
1. Teacher submits teaching report
2. Check parent's notification inbox

**Current Behavior:**
- ❌ No notification sent

**Recommended Behavior:**
- ✅ Parent receives notification: "Giáo viên [Name] đã nộp báo cáo buổi học ngày [Date]"
- Link to view report details

---

## VIII. DATA QUALITY TESTING

### Test Case 25: Report Quality Scoring

**Setup:**
Create 3 reports:
1. **High quality**: All 6 fields filled, each > 100 chars
2. **Medium quality**: lessonContent + teacherComment only
3. **Low quality**: lessonContent only (minimal)

**Verification:**
```javascript
// Calculate quality score (0-100)
const score1 = calculateReportQuality(report1);  // Expected: 90-100
const score2 = calculateReportQuality(report2);  // Expected: 50-70
const score3 = calculateReportQuality(report3);  // Expected: 10-30
```

**Implementation:**
```javascript
function calculateReportQuality(report) {
  let score = 0;
  
  // Lesson content (max 30 points)
  if (report.lessonContent?.length >= 200) score += 30;
  else if (report.lessonContent?.length >= 100) score += 20;
  else if (report.lessonContent?.length >= 50) score += 10;
  
  // Teacher comment (max 25 points)
  if (report.teacherComment?.length >= 100) score += 25;
  else if (report.teacherComment?.length >= 50) score += 15;
  else if (report.teacherComment) score += 5;
  
  // Student attitude (max 15 points)
  if (report.studentAttitude?.length >= 50) score += 15;
  else if (report.studentAttitude) score += 5;
  
  // Homework (max 15 points)
  if (report.homework?.length >= 20) score += 15;
  else if (report.homework) score += 5;
  
  // Recording URL (10 points)
  if (report.recordingUrl) score += 10;
  
  // Additional notes (5 points)
  if (report.additionalNotes?.length >= 30) score += 5;
  
  return Math.min(score, 100);
}
```

---

## IX. SUMMARY

### Critical Test Cases (Must Pass)
- ✅ TC1: Happy path submission
- ✅ TC4: Ownership validation (teacher can only submit for own sessions)
- ✅ TC5/6: Cannot submit for CANCELLED/RESCHEDULED
- ✅ TC10: Payroll integration (only sessions with reports counted)

### High Priority Test Cases
- ⚠️ TC9: Should block submission for SCHEDULED sessions
- ⚠️ TC14: Validate recordingUrl format
- ⚠️ TC15: Enforce minimum lessonContent length
- ⚠️ TC17: Enforce deadline for report submission

### Medium Priority
- TC7: Update existing report
- TC11: Query pending reports
- TC13: Performance with index
- TC24: Notification after submission

### Low Priority
- TC25: Quality scoring (analytics)
- TC23: Dashboard UX
- TC18/19: Security (already handled by framework)

---

## 🚀 NEXT STEPS

1. **Run all test cases** against current implementation
2. **Document failures** and create bug tickets
3. **Implement missing validations** (recordingUrl, minLength, deadline)
4. **Add unit tests** for `submitTeachingReport()` method
5. **Add integration tests** for payroll query
6. **Set up E2E tests** for critical user flows
7. **Monitor production metrics**:
   - Report submission rate
   - Average submission delay
   - Quality score distribution
   - Sessions at risk (FINALIZED without reports)

---

## 📊 TEST COVERAGE MATRIX

| Feature | Unit Test | Integration Test | E2E Test | Manual Test |
|---------|-----------|------------------|----------|-------------|
| Submit report | ✅ | ✅ | ✅ | ✅ |
| Update report | ✅ | - | ✅ | ✅ |
| Ownership check | ✅ | - | - | ✅ |
| Status validation | ✅ | - | ✅ | - |
| Payroll integration | - | ✅ | ✅ | ✅ |
| Query pending | ✅ | ✅ | - | - |
| Notification | - | ✅ | ✅ | - |
| Quality scoring | ✅ | - | - | ✅ |
| Dashboard widget | - | - | ✅ | ✅ |
