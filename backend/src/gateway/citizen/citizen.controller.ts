import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  UseGuards,
  Request,
  Delete,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { CitizenProxyService } from './citizen.proxy.service.js';

@Controller('citizen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.CITIZEN)
export class CitizenController {
  constructor(
    @Inject(CitizenProxyService)
    private readonly citizenProxyService: CitizenProxyService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.getCitizenProfile(userId);
  }

  @Post('register')
  async register(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.createCitizen({ ...body, userId });
  }

  @Post('family')
  async family(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.createFamily({ ...body, headUserId: userId });
  }

  @Post('animal')
  async animal(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.createAnimal({ ...body, userId });
  }

  @Delete('family/:qrCodeId')
  async deleteFamilyMembers(@Param('qrCodeId') qrCodeId: string) {
    return this.citizenProxyService.deleteFamilyMembersByQr(qrCodeId);
  }

  @Delete('animal')
  async deleteAnimals(@Request() req: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.deleteAnimalsByUser(userId);
  }

  @Get('family')
  async getFamily(@Request() req: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.getFamiliesByHead(userId);
  }

  @Get('animals')
  async getAnimals(@Request() req: any) {
    const userId = req.user.sub;
    return this.citizenProxyService.getAnimalsByUser(userId);
  }

  @Post('incident-report')
  async createIncidentReport(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;

    const activeDisaster = await this.citizenProxyService.findActiveDisasterEvent();
    if (!activeDisaster) {
      throw new NotFoundException('No active disaster event found to link the report to.');
    }

    return this.citizenProxyService.createIncidentReport({
      ...body,
      reportedBy: userId,
      disasterId: body.disasterId || activeDisaster.id,
    });
  }
}
