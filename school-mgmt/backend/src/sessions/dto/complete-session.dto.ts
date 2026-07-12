import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LessonProgressStatus } from '../schemas/session.schema';

/**
 * GV hoàn thành buổi dạy → chuyển status SCHEDULED → TEACHER_COMPLETED
 * Bao gồm đánh giá buổi học, nội dung giảng dạy, đánh giá HS
 */
export class CompleteSessionDto {
  // ── Legacy content fields ──
  @IsString()
  @IsOptional()
  topicsCovered?: string;

  @IsString()
  @IsOptional()
  homework?: string;

  @IsString()
  @IsOptional()
  teacherNotes?: string;

  @IsDateString()
  @IsOptional()
  actualStartTime?: string;

  @IsDateString()
  @IsOptional()
  actualEndTime?: string;

  // ── Đánh giá buổi học chi tiết (evaluation) ──

  /** Mục tiêu buổi học */
  @IsString()
  @IsOptional()
  lessonObjective?: string;

  /** Nội dung bài giảng chi tiết */
  @IsString()
  @IsOptional()
  lessonContent?: string;

  /** Tài liệu/giáo trình sử dụng */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  materialsUsed?: string[];

  /** Kỹ năng giảng dạy trong buổi */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skillsTaught?: string[];

  /** Năng lực HS (1=Yếu → 5=Xuất sắc) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  studentPerformance?: number;

  /** Mức độ tập trung/tham gia (1→5) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  studentEngagement?: number;

  /** Mức độ hiểu bài (1→5) */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  comprehensionLevel?: number;

  @IsEnum(LessonProgressStatus)
  @IsOptional()
  lessonProgressStatus?: LessonProgressStatus;

  @IsString()
  @IsOptional()
  deviationReason?: string;

  /** Điểm mạnh quan sát được */
  @IsString()
  @IsOptional()
  strengthsObserved?: string;

  /** Điểm cần cải thiện */
  @IsString()
  @IsOptional()
  areasOfImprovement?: string;

  /** Bài tập về nhà chi tiết */
  @IsString()
  @IsOptional()
  homeworkAssigned?: string;

  /** Hạn nộp bài tập */
  @IsDateString()
  @IsOptional()
  homeworkDeadline?: string;

  /** Tiến độ hoàn thành nội dung khóa (0-100%) */
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progressPercent?: number;

  /** IDs/tên mục chương trình đã hoàn thành trong buổi */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  curriculumItemsCompleted?: string[];

  /** Kế hoạch buổi học tiếp theo */
  @IsString()
  @IsOptional()
  nextSessionPlan?: string;

  /** Nhận xét tổng quan buổi học */
  @IsString()
  @IsOptional()
  overallComment?: string;
}
