import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PageDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  pageSize?: number;
}
