import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { RampModule } from './ramp/ramp.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), 'apps/api/.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    SupabaseModule,
    RampModule,
  ],
})
export class AppModule {}
