import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Inject,
  UseGuards,
  Request,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { RegistrationsService } from '../../registrations/registrations.service.js';
import { IncidentReportsService } from '../../incident-reports/incident-reports.service.js';
import { DisasterEventsService } from '../../disaster-events/disaster-events.service.js';
import { FamilyGroupsService } from '../../family-groups/family-groups.service.js';
import { generateQrCodeId } from '../../utils/qr-utils.js';

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
    @Inject(FamilyGroupsService)
    private readonly familyGroupsService: FamilyGroupsService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = req.user.sub;
    const email: string | undefined = req.user.email;
    const citizens = await this.registrationsService.findCitizens();
    const citizen = citizens.find(c => c.userId === userId);

    if (citizen && !citizen.profilePhotoKey && email) {
      const photoKey = await this.registrationsService.findProfilePhotoFromStorage(email, 'citizen');
      if (photoKey) {
        citizen.profilePhotoKey = photoKey;
        await this.registrationsService.saveProfilePhotoKey(userId, photoKey);
      }
    }

    return citizen;
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
      qrCodeId: undefined,
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

  @Put('family/:id')
  async updateFamily(@Param('id') id: string, @Body() body: any) {
    return this.citizenProxyService.updateFamily(id, body);
  }

  @Delete('family/member/:id')
  async deleteFamilyMember(@Param('id') id: string) {
    return this.citizenProxyService.deleteFamily(id);
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

  // ─── Family Group endpoints ───────────────────────────────────────────────

  @Get('family-group')
  async getFamilyGroup(@Request() req: any) {
    const userId = req.user.sub;
    return this.familyGroupsService.getGroupByUser(userId);
  }

  @Post('family-group')
  async createFamilyGroup(@Request() req: any, @Body() body: { familyName?: string }) {
    const userId = req.user.sub;
    const familyQrCodeId = generateQrCodeId('FAM');
    return this.familyGroupsService.createGroup({
      familyQrCodeId,
      headUserId: userId,
      familyName: body.familyName,
    });
  }

  @Post('family-group/members')
  async addFamilyGroupMember(@Request() req: any, @Body() body: { citizenQrCodeId: string; relationship?: string }) {
    const userId = req.user.sub;
    const group = await this.familyGroupsService.getGroupByHeadUser(userId);
    if (!group) {
      throw new Error('Create a family group first before adding members');
    }
    return this.familyGroupsService.addMember({
      familyGroupId: group.id,
      citizenQrCodeId: body.citizenQrCodeId,
      relationship: body.relationship,
    });
  }

  @Delete('family-group/members/:qrCodeId')
  async removeFamilyGroupMember(@Request() req: any, @Param('qrCodeId') qrCodeId: string) {
    const userId = req.user.sub;
    const group = await this.familyGroupsService.getGroupByHeadUser(userId);
    if (!group) return { ok: true };
    await this.familyGroupsService.removeMember(group.id, qrCodeId);
    return { ok: true };
  }

  @Delete('family-group')
  async deleteFamilyGroup(@Request() req: any) {
    const userId = req.user.sub;
    await this.familyGroupsService.deleteGroup(userId);
    return { ok: true };
  }

  /** Lookup a citizen by QR code — used when scanning members to preview their info. */
  @Get('lookup-citizen')
  async lookupCitizen(@Query('qrCode') qrCode: string) {
    if (!qrCode) return null;
    const citizens = await this.registrationsService.findCitizens(qrCode);
    return citizens.find((c) => c.qrCodeId === qrCode) ?? null;
  }

  // ─── Incident report ─────────────────────────────────────────────────────

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
