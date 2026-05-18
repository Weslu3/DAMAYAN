import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: (() => {
          const secret = configService.get<string>('JWT_SECRET');
          if (!secret) {
            throw new Error('Missing JWT_SECRET environment variable');
          }
          return secret;
        })(),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
