import { IsString, MinLength } from 'class-validator';

export class ReportFileDto {
  @IsString()
  @MinLength(1)
  filename!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}
