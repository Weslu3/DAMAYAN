import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Inject,
  UseGuards,
  Request,
  Delete,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { RegistrationsService } from '../../registrations/registrations.service.js';
import { IncidentReportsService } from '../../incident-reports/incident-reports.service.js';
import { DisasterEventsService } from '../../disaster-events/disaster-events.service.js';

@Controller('citizen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.CITIZEN)
export class CitizenController {
  constructor(
    @Inject(RegistrationsService)
    private readonly registrationsService: RegistrationsService,
    @Inject(IncidentReportsService)
    private readonly incidentReportsService: IncidentReportsService,
    @Inject(DisasterEventsService)
    private readonly disasterEventsService: DisasterEventsService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req.user.sub;
    const citizens = await this.registrationsService.findCitizens();
    return citizens.find(c => c.userId === userId);
  }

  @Patch('medical')
  async updateMedical(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    return this.registrationsService.updateCitizen(userId, {
      bloodType: body.bloodType,
      medicalConditions: body.medicalConditions,
    });
  }

  @Post('register')
  async register(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    console.log('Registering citizen for user:', userId);
    return this.registrationsService.createCitizen({
      ...body,
      userId,
    });
  }

  @Post('family')
  async family(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    console.log('Adding family member for head user:', userId);
    return this.registrationsService.createFamily({
      ...body,
      headUserId: userId,
    });
  }

  @Post('animal')
  async animal(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    console.log('Adding animal for user:', userId);
    return this.registrationsService.createAnimal({
      ...body,
      userId,
    });
  }

  @Delete('family/:qrCodeId')
  async deleteFamilyMembers(@Param('qrCodeId') qrCodeId: string) {
    console.log('Clearing family members for QR:', qrCodeId);
    return this.registrationsService.deleteFamilyMembersByQr(qrCodeId);
  }

  @Delete('animal')
  async deleteAnimals(@Request() req: any) {
    const userId = req.user.sub;
    console.log('Clearing animals for user:', userId);
    return this.registrationsService.deleteAnimalsByUser(userId);
  }

  @Get('family')
  async getFamily(@Request() req: any) {
    const userId = req.user.sub;
    return this.registrationsService.findFamiliesByHead(userId);
  }

  @Get('animals')
  async getAnimals(@Request() req: any) {
    const userId = req.user.sub;
    return this.registrationsService.findAnimalsByUser(userId);
  }

  @Post('incident-report')
  async createIncidentReport(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub;
    console.log('Creating incident report for user:', userId);
    
    // Find active disaster to link to
    const activeDisaster = await this.disasterEventsService.findActive();
    if (!activeDisaster) {
      throw new Error('No active disaster event found to link the report to.');
    }

    return this.incidentReportsService.create({
      ...body,
      reportedBy: userId,
      disasterId: body.disasterId || activeDisaster.id,
    });
  }
}
