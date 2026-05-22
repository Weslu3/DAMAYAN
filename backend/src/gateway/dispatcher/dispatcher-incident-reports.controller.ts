import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('units')
  findVolunteerUnits(@Query('search') search?: string) {
    return this.dispatcherService.findVolunteerUnits(search);
  }

  @Get('volunteer-teams')
  findVolunteerTeams(@Query('search') search?: string) {
    return this.dispatcherService.findVolunteerTeams(search);
  }

  @Post('broadcast')
  broadcast(
    @Req() request: RequestWithUser,
    @Body() payload: CreateDispatcherBroadcastDto,
  ) {
    return this.dispatcherService.broadcast(request.user.sub, payload);
  }
}
