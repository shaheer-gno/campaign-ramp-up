import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GenerateDto } from './dto/generate.dto';
import { Gate1IdsDto } from './dto/gate1-ids.dto';
import { PreviewApplyDto } from './dto/preview-apply.dto';
import { ReportFromDbDto } from './dto/report-from-db.dto';
import { RampService } from './ramp.service';

@Controller('ramp')
export class RampController {
  constructor(private readonly ramp: RampService) {}

  @Post('generate')
  generate(@Body() dto: GenerateDto) {
    return this.ramp.generate(dto);
  }

  @Post('report-from-db')
  reportFromDb(@Body() dto: ReportFromDbDto) {
    return this.ramp.reportFromDb(dto);
  }

  @Post('gate1-ids')
  gate1Ids(@Body() dto: Gate1IdsDto) {
    return this.ramp.gate1Ids(dto);
  }

  @Post('preview')
  preview(@Body() dto: PreviewApplyDto) {
    return this.ramp.preview(dto);
  }

  @Post('apply')
  apply(@Body() dto: PreviewApplyDto) {
    return this.ramp.apply(dto);
  }

  @Get('changelog/campaigns')
  changelogCampaigns() {
    return this.ramp.changelogCampaigns();
  }

  @Get('changelog')
  changelog(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.ramp.changelog({
      page: page != null ? Number(page) : undefined,
      pageSize: pageSize != null ? Number(pageSize) : undefined,
      campaignId,
    });
  }
}
