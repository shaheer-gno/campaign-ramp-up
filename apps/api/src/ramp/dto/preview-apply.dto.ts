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
import type { RampGroup } from '../types';
import { PageDto } from './page.dto';

export class CampaignRampDto {
  @IsString()
  id!: string;

  @IsNumber()
  @IsIn([3, 5, 7, 10])
  percent!: 3 | 5 | 7 | 10;
}

export class PreviewApplyDto extends PageDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOf?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  clickCap?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['bidding', 'placements', 'audience', 'b2b'], { each: true })
  groups!: RampGroup[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignRampDto)
  campaigns!: CampaignRampDto[];
}
