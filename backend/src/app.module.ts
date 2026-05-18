import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtModule } from '@nestjs/jwt';
import { AuthGatewayModule } from './gateway/auth/auth-gateway.module.js';
import { SiteManagerGatewayModule } from './gateway/site-manager/site-manager.module.js';
import { AdminGatewayModule } from './gateway/admin/admin.module.js';
import { DispatcherModule } from './gateway/dispatcher/dispatcher.module.js';
import { CitizenGatewayModule } from './gateway/citizen/citizen-gateway.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = resolve(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(backendRoot, '.env'),
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'replace-this-with-a-long-random-secret',
      signOptions: { expiresIn: '7d' },
    }),
    AuthGatewayModule,
    SiteManagerGatewayModule,
    AdminGatewayModule,
    DispatcherModule,
    CitizenGatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
