import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class InlineUpdateDto {
  /** Nội dung buổi học → SSOT: Sessions.teachingReport.lessonContent */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sessionContent?: string;

  /** Nhận xét giáo viên → SSOT: Sessions.teachingReport.teacherComment */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /** Link ghi hình → SSOT: Sessions.teachingReport.recordingUrl */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'recordLink phải là URL hợp lệ' })
  recordLink?: string;

  /** Ảnh điểm danh → SSOT: Attendance.imageUrl */
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
