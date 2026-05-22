import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { AppRole } from '../../libs/contracts/src/roles.js';
import { RegionsService } from './regions.service.js';
import { CreateShelterAssignmentDto } from './dto/create-shelter-assignment.dto.js';
import { CreateRegionAssignmentDto } from './dto/create-region-assignment.dto.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { UpdateRegionPhaseDto } from './dto/update-region-phase.dto.js';
import { UpsertRegionPersonaPhaseDto } from './dto/upsert-region-persona-phase.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
export class RegionsController {
  constructor(@Inject(RegionsService) private readonly regionsService: RegionsService) {}

  @Get('regions')
  findAllRegions() {
    return this.regionsService.findAll();
  }

  @Post('regions')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.regionsService.createRegion(dto);
  }

  @Get('regions/geo')
  findAllRegionsGeo() {
    return this.regionsService.getAllRegionsGeo();
  }

  @Get('regions/:id/geo')
  findRegionGeo(@Param('id') id: string) {
    return this.regionsService.getRegionGeo(id);
  }

  @Get('regions/:id/shelters')
  findRegionShelters(@Param('id') id: string) {
    return this.regionsService.getRegionShelters(id);
  }

  @Patch('regions/:id/phase')
  updateRegionPhase(@Param('id') id: string, @Body() dto: UpdateRegionPhaseDto) {
    return this.regionsService.updatePhase(id, dto.newPhase);
  }

  @Get('regions/:id/persona-phase-controls')
  findPersonaPhaseControls(@Param('id') id: string) {
    return this.regionsService.findPersonaPhaseControls(id);
  }

  @Post('regions/:id/persona-phase-controls')
  upsertPersonaPhaseControl(@Param('id') id: string, @Body() dto: UpsertRegionPersonaPhaseDto) {
    return this.regionsService.upsertPersonaPhaseControl(id, dto);
  }

  @Get('regions/:id/persona-phase-controls/audience')
  findPersonaPhaseAudience(@Param('id') id: string, @Query('personaRole') personaRole?: AppRole) {
    return this.regionsService.findPersonaPhaseAudience(id, personaRole);
  }

  @Get('shelter-assignments')
  findAssignments(@Query('centerId') centerId?: string) {
    return this.regionsService.findAssignments(centerId);
  }

  @Post('shelter-assignments')
  createAssignment(@Body() dto: CreateShelterAssignmentDto) {
    return this.regionsService.createAssignment(dto);
  }

  @Delete('shelter-assignments/:managerId')
  deleteAssignment(@Param('managerId') managerId: string) {
    return this.regionsService.deleteAssignment(managerId);
  }

  @Get('regions/:id/assignments')
  findRegionAssignments(@Param('id') id: string) {
    return this.regionsService.findRegionAssignments(id);
  }

  @Get('regions/:id/available-users')
  findAvailableUsers(@Param('id') id: string, @Query('role') role?: string, @Query('search') search?: string) {
    return this.regionsService.findAvailableUsers(id, role, search);
  }

  @Post('regions/:id/assignments')
  createRegionAssignment(@Req() request: any, @Param('id') id: string, @Body() dto: CreateRegionAssignmentDto) {
    const assignedBy = request?.user?.sub ?? null;
    return this.regionsService.createRegionAssignment(id, dto, assignedBy);
  }

  @Delete('regions/:id/assignments/:assignmentId')
  deleteRegionAssignment(@Param('assignmentId') assignmentId: string) {
    return this.regionsService.deleteRegionAssignment(assignmentId);
  }
}
