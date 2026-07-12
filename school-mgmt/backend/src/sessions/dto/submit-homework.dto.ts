import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export class SubmitHomeworkDto {
  @IsString({ message: 'Noi dung bai lam phai la chuoi van ban' })
  @IsOptional()
  @MaxLength(4000, { message: 'Noi dung bai lam khong duoc vuot qua 4000 ky tu' })
  @Transform(trimToUndefined)
  submissionText?: string;

  @IsString({ message: 'Link video bai lam phai la chuoi van ban' })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link video bai lam phai la URL hop le' })
  @MaxLength(1000, { message: 'Link video bai lam khong duoc vuot qua 1000 ky tu' })
  @Transform(trimToUndefined)
  submissionVideoUrl?: string;
}
