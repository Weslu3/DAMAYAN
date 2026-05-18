import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

type SupabaseClientInstance = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClientInstance;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClientInstance {
    return this.client;
  }
}
