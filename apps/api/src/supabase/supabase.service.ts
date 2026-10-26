import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL')?.trim();
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    if (!url || !key) {
      throw new Error(
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env (from pnpm db:status).',
      );
    }
    this.client = createClient(url, key);
  }

  async onModuleInit(): Promise<void> {
    const { error } = await this.client.from('campaigns').select('id').limit(1);
    if (error) {
      throw new Error(
        `Database connection failed: ${error.message}. Run pnpm db:start and pnpm db:migrate.`,
      );
    }
    this.logger.log('Database connection OK');
  }
}
