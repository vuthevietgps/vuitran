import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ApproveOrderDto {
  @IsString()
  @IsOptional()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'approvalImage phai la URL, upload path, hoac base64 image',
  })
  approvalImage?: string;
}

export class RejectOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Ly do tu choi khong duoc de trong' })
  reason!: string;
}

export class RequestInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'Ly do yeu cau bo sung khong duoc de trong' })
  reason!: string;
}
