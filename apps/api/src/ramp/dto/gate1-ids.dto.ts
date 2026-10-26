import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class Gate1IdsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  spendThresholdUsd?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOf?: string;
}
