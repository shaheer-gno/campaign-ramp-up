import { Module } from '@nestjs/common';
import { AdsRepository } from './ads.repository';
import { AdsService } from './ads.service';

/**
 * Amazon Ads data layer: report parse + working snapshot persistence.
 * Exports AdsService only (repository stays internal). No controller.
 */
@Module({
  providers: [AdsRepository, AdsService],
  exports: [AdsService],
})
export class AdsModule {}
