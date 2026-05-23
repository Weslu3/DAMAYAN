import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../incident-reports/dto/update-incident-report.dto.js';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from '../../dispatch-orders/dto/update-dispatch-order.dto.js';
import { DispatcherService } from './dispatcher.service.js';
import { CreateDispatcherBroadcastDto } from './dto/create-dispatcher-broadcast.dto.js';
import { ApiCenterService } from '../../apicenter/apicenter.service.js';

interface RequestWithUser {
  user: {
    sub: string;
    email: string;
    role: AppRole;
  };
}

@Controller('dispatcher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.DISPATCHER)
export class DispatcherIncidentReportsController {
  constructor(
    @Inject(DispatcherService)
    private readonly dispatcherService: DispatcherService,
    @Inject(ApiCenterService)
    private readonly apiCenterService: ApiCenterService,
  ) {}

  @Get('overview')
  getOverview(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.dispatcherService.getOverview(search, disasterId);
  }

  @Get('profile')
  getProfile(@Req() request: RequestWithUser) {
    return this.dispatcherService.getProfile(request.user.sub);
  }

  @Get('geo/geocode')
  async geocodeAddress(@Query('address') address?: string) {
    const input = address?.trim();

    if (!input) {
      throw new BadRequestException('address query is required');
    }

    const result = await this.apiCenterService.geoGeocode(input);
    const latitude = Number((result as any).latitude ?? (result as any).lat);
    const longitude = Number((result as any).longitude ?? (result as any).lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Unable to geocode address');
    }

    return {
      formattedAddress: (result as any).formattedAddress ?? (result as any).formatted_address ?? input,
      latitude,
      longitude,
      placeId: (result as any).placeId ?? (result as any).place_id,
      provider: (result as any).provider ?? 'apicenter',
    };
  }

  @Get('incident-reports')
  findIncidentReports(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.dispatcherService.findIncidentReports(search, disasterId);
  }

  @Post('incident-reports')
  createIncidentReport(@Body() createIncidentReportDto: CreateIncidentReportDto) {
    return this.dispatcherService.createIncidentReport(createIncidentReportDto);
  }

  @Patch('incident-reports/:id')
  updateIncidentReport(
    @Param('id') id: string,
    @Body() updateIncidentReportDto: UpdateIncidentReportDto,
  ) {
    return this.dispatcherService.updateIncidentReport(id, updateIncidentReportDto);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.dispatcherService.deleteIncidentReport(id);
  }

  @Get('dispatch-orders')
  findDispatchOrders(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.dispatcherService.findDispatchOrders(search, operationId, disasterId);
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.dispatcherService.createDispatchOrder(createDispatchOrderDto);
  }

  @Put('dispatch-orders/:id')
  updateDispatchOrder(
    @Param('id') id: string,
    @Body() updateDispatchOrderDto: UpdateDispatchOrderDto,
  ) {
    return this.dispatcherService.updateDispatchOrder(id, updateDispatchOrderDto);
  }

  @Patch('dispatch-orders/:id')
  patchDispatchOrder(
    @Param('id') id: string,
    @Body() updateDispatchOrderDto: UpdateDispatchOrderDto,
  ) {
    return this.dispatcherService.updateDispatchOrder(id, updateDispatchOrderDto);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.dispatcherService.deleteDispatchOrder(id);
  }

  @Get('resources')
  findResources(@Query('search') search?: string) {
    return this.dispatcherService.findResources(search);
  }

  @Get('volunteers')
  findVolunteerOrganizations(@Query('search') search?: string) {
    return this.dispatcherService.findResources(search);
  }

  @Get('units')
  findVolunteerUnits(@Query('search') search?: string) {
    return this.dispatcherService.findVolunteerUnits(search);
  }

  @Get('volunteer-teams')
  findVolunteerTeams(@Query('search') search?: string) {
    return this.dispatcherService.findVolunteerTeams(search);
  }

  @Get('barangay-data')
  getBarangayData(@Query('province') province?: string) {
    return this.dispatcherService.getBarangayData(province);
  }

  @Get('team-status')
  getTeamStatus() {
    return this.dispatcherService.getTeamStatus();
  }

  @Patch('team-status/:authUserId')
  setDutyStatus(
    @Param('authUserId') authUserId: string,
    @Body('dutyStatus') dutyStatus: 'on_duty' | 'off_duty',
  ) {
    if (dutyStatus !== 'on_duty' && dutyStatus !== 'off_duty') {
      throw new BadRequestException("dutyStatus must be 'on_duty' or 'off_duty'");
    }
    return this.dispatcherService.setDutyStatus(authUserId, dutyStatus);
  }

  @Post('volunteer-dispatch')
  createVolunteerDispatch(@Body() body: {
    reportId: string;
    assignedTo: string;
    volunteerName?: string;
    priority?: string;
    instructions?: string;
    disasterId?: string;
  }) {
    return this.dispatcherService.createVolunteerDispatch(body);
  }

  @Post('broadcast')
  broadcast(
    @Req() request: RequestWithUser,
    @Body() payload: CreateDispatcherBroadcastDto,
  ) {
    return this.dispatcherService.broadcast(request.user.sub, payload);
  }
}
