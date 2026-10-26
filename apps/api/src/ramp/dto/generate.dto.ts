import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageDto } from './page.dto';
import { ReportFileDto } from './report-file.dto';

export class GenerateDto extends PageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReportFileDto)
  files!: ReportFileDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  spendThresholdUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  clickCap?: number;

  @IsOptional()
  @IsNumber()
  @IsIn([3, 5, 7, 10])
  percent?: 3 | 5 | 7 | 10;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOf?: string;
}
