import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { AuthMessageController } from './auth-message.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = resolve(__dirname, '../../..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(backendRoot, '.env'),
    }),
    AuthModule,
  ],
  controllers: [AuthMessageController],
})
export class AuthServiceAppModule {}
