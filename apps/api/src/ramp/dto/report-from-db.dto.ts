import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PageDto } from './page.dto';

export class ReportFromDbDto extends PageDto {
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
