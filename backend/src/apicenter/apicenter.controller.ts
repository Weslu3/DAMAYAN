import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCenterService } from './apicenter.service.js';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { AppRole } from '../../libs/contracts/src/roles.js';

@Controller('apicenter')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN, AppRole.LINE_MANAGER)
export class ApiCenterController {
  constructor(private readonly apiCenterService: ApiCenterService) {}

  @Get('status')
  getStatus() {
    return this.apiCenterService.getStatus();
  }

  @Get('services')
  listAccessibleServices() {
    return this.apiCenterService.listAccessibleServices();
  }
}
