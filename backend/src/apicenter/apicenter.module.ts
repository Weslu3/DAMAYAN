import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterController } from './apicenter.controller.js';
import { ApiCenterService } from './apicenter.service.js';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [ApiCenterController],
  providers: [ApiCenterService, JwtAuthGuard, RolesGuard],
  exports: [ApiCenterService],
})
export class ApiCenterModule {}
