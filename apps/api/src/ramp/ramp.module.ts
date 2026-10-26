import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { RampController } from './ramp.controller';
import { RampService } from './ramp.service';

@Module({
  imports: [AdsModule],
  controllers: [RampController],
  providers: [RampService],
})
export class RampModule {}
