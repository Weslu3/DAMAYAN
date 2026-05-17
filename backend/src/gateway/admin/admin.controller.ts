import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Put,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { AdminProxyService } from './admin.proxy.service.js';
import { CreateItemDto } from '../../inventory/dto/create-item.dto.js';
import { UpdateItemDto } from '../../inventory/dto/update-item.dto.js';
import { AdjustQuantityDto } from '../../inventory/dto/adjust-quantity.dto.js';
import { CreateOrganizationDto } from '../../organizations/dto/create-organization.dto.js';
import { UpdateOrganizationDto } from '../../organizations/dto/update-organization.dto.js';
import { CreateDisasterEventDto } from '../../disaster-events/dto/create-disaster-event.dto.js';
import { UpdateDisasterEventDto } from '../../disaster-events/dto/update-disaster-event.dto.js';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from '../../dispatch-orders/dto/update-dispatch-order.dto.js';
import { CreateReliefOperationDto } from '../../relief-operations/dto/create-relief-operation.dto.js';
import { UpdateReliefOperationDto } from '../../relief-operations/dto/update-relief-operation.dto.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../incident-reports/dto/update-incident-report.dto.js';
import { CreateDistributionDto } from '../../distributions/dto/create-distribution.dto.js';
import { UpdateDistributionDto } from '../../distributions/dto/update-distribution.dto.js';
import { CreateCitizenDto } from '../../registrations/dto/create-citizen.dto.js';
import { UpdateCitizenDto } from '../../registrations/dto/update-citizen.dto.js';
import { CreateFamilyDto } from '../../registrations/dto/create-family.dto.js';
import { UpdateFamilyDto } from '../../registrations/dto/update-family.dto.js';
import { CreateDisasterCoverUploadDto } from '../../uploads/dto/create-disaster-cover-upload.dto.js';
import { CreateIncidentAttachmentUploadDto } from '../../uploads/dto/create-incident-attachment-upload.dto.js';
import { CreateObjectViewUrlDto } from '../../uploads/dto/create-object-view-url.dto.js';
import { CreateWarningBroadcastDto } from './dto/create-warning-broadcast.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
export class AdminController {
  constructor(@Inject(AdminProxyService) private readonly adminProxyService: AdminProxyService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminProxyService.getDashboard();
  }

  @Get('inventory')
  findInventory(@Query('search') search?: string) {
    return this.adminProxyService.findInventory(search);
  }

  @Get('inventory/stats')
  getInventoryStats() {
    return this.adminProxyService.getInventoryStats();
  }

  @Post('inventory')
  createInventoryItem(@Body() createItemDto: CreateItemDto) {
    return this.adminProxyService.createInventoryItem(createItemDto);
  }

  @Put('inventory/:id')
  updateInventoryItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.adminProxyService.updateInventoryItem(id, updateItemDto);
  }

  @Patch('inventory/:id/adjust')
  adjustInventoryItem(
    @Param('id') id: string,
    @Body() adjustQuantityDto: AdjustQuantityDto,
  ) {
    return this.adminProxyService.adjustInventoryItem(id, adjustQuantityDto);
  }

  @Get('capacity')
  findCapacity(@Query('search') search?: string) {
    return this.adminProxyService.findCapacity(search);
  }

  @Get('capacity/stats')
  getCapacityStats() {
    return this.adminProxyService.getCapacityStats();
  }

  @Get('organizations')
  findOrganizations(@Query('search') search?: string) {
    return this.adminProxyService.findOrganizations(search);
  }

  @Get('approvals')
  findPendingApprovals() {
    return this.adminProxyService.findPendingApprovals();
  }

  @Patch('approvals/:id/approve')
  approvePendingUser(@Param('id') id: string) {
    return this.adminProxyService.approvePendingUser(id);
  }

  @Patch('approvals/:id/reject')
  rejectPendingUser(@Param('id') id: string, @Body('rejectReason') rejectReason: string) {
    return this.adminProxyService.rejectPendingUser(id, rejectReason);
  }

  @Get('system-health')
  getSystemHealth() {
    return this.adminProxyService.getSystemHealth();
  }

  @Post('warnings/broadcast')
  broadcastWarning(@Body() createWarningBroadcastDto: CreateWarningBroadcastDto) {
    return this.adminProxyService.broadcastWarning(createWarningBroadcastDto);
  }

  @Get('organizations/stats')
  getOrganizationStats() {
    return this.adminProxyService.getOrganizationStats();
  }

  @Post('organizations')
  createOrganization(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.adminProxyService.createOrganization(createOrganizationDto);
  }

  @Put('organizations/:id')
  updateOrganization(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.adminProxyService.updateOrganization(id, updateOrganizationDto);
  }

  @Delete('organizations/:id')
  deleteOrganization(@Param('id') id: string) {
    return this.adminProxyService.deleteOrganization(id);
  }

  @Get('disaster-events')
  findDisasterEvents(@Query('search') search?: string) {
    return this.adminProxyService.findDisasterEvents(search);
  }

  @Get('disaster-events/stats')
  getDisasterEventStats() {
    return this.adminProxyService.getDisasterEventStats();
  }

  @Get('dispatch-orders')
  findDispatchOrders(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.adminProxyService.findDispatchOrders(search, operationId);
  }

  @Get('dispatch-orders/stats')
  getDispatchOrderStats() {
    return this.adminProxyService.getDispatchOrderStats();
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.adminProxyService.createDispatchOrder(createDispatchOrderDto);
  }

  @Put('dispatch-orders/:id')
  updateDispatchOrder(
    @Param('id') id: string,
    @Body() updateDispatchOrderDto: UpdateDispatchOrderDto,
  ) {
    return this.adminProxyService.updateDispatchOrder(id, updateDispatchOrderDto);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.adminProxyService.deleteDispatchOrder(id);
  }

  @Post('disaster-events')
  createDisasterEvent(@Body() createDisasterEventDto: CreateDisasterEventDto) {
    return this.adminProxyService.createDisasterEvent(createDisasterEventDto);
  }

  @Put('disaster-events/:id')
  updateDisasterEvent(
    @Param('id') id: string,
    @Body() updateDisasterEventDto: UpdateDisasterEventDto,
  ) {
    return this.adminProxyService.updateDisasterEvent(id, updateDisasterEventDto);
  }

  @Delete('disaster-events/:id')
  deleteDisasterEvent(@Param('id') id: string) {
    return this.adminProxyService.deleteDisasterEvent(id);
  }

  @Get('relief-operations')
  findReliefOperations(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.adminProxyService.findReliefOperations(search, disasterId);
  }

  @Get('relief-operations/stats')
  getReliefOperationStats() {
    return this.adminProxyService.getReliefOperationStats();
  }

  @Post('relief-operations')
  createReliefOperation(@Body() createReliefOperationDto: CreateReliefOperationDto) {
    return this.adminProxyService.createReliefOperation(createReliefOperationDto);
  }

  @Put('relief-operations/:id')
  updateReliefOperation(
    @Param('id') id: string,
    @Body() updateReliefOperationDto: UpdateReliefOperationDto,
  ) {
    return this.adminProxyService.updateReliefOperation(id, updateReliefOperationDto);
  }

  @Delete('relief-operations/:id')
  deleteReliefOperation(@Param('id') id: string) {
    return this.adminProxyService.deleteReliefOperation(id);
  }

  @Get('incident-reports')
  findIncidentReports(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.adminProxyService.findIncidentReports(search, disasterId);
  }

  @Get('incident-reports/stats')
  getIncidentReportStats() {
    return this.adminProxyService.getIncidentReportStats();
  }

  @Post('incident-reports')
  createIncidentReport(@Body() createIncidentReportDto: CreateIncidentReportDto) {
    return this.adminProxyService.createIncidentReport(createIncidentReportDto);
  }

  @Put('incident-reports/:id')
  updateIncidentReport(
    @Param('id') id: string,
    @Body() updateIncidentReportDto: UpdateIncidentReportDto,
  ) {
    return this.adminProxyService.updateIncidentReport(id, updateIncidentReportDto);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.adminProxyService.deleteIncidentReport(id);
  }

  @Get('distributions')
  findDistributions(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.adminProxyService.findDistributions(search, operationId);
  }

  @Get('distributions/stats')
  getDistributionStats() {
    return this.adminProxyService.getDistributionStats();
  }

  @Post('distributions')
  createDistribution(@Body() createDistributionDto: CreateDistributionDto) {
    return this.adminProxyService.createDistribution(createDistributionDto);
  }

  @Put('distributions/:id')
  updateDistribution(
    @Param('id') id: string,
    @Body() updateDistributionDto: UpdateDistributionDto,
  ) {
    return this.adminProxyService.updateDistribution(id, updateDistributionDto);
  }

  @Delete('distributions/:id')
  deleteDistribution(@Param('id') id: string) {
    return this.adminProxyService.deleteDistribution(id);
  }

  @Get('citizens')
  findCitizens(@Query('search') search?: string) {
    return this.adminProxyService.findCitizens(search);
  }

  @Post('citizens')
  createCitizen(@Body() createCitizenDto: CreateCitizenDto) {
    return this.adminProxyService.createCitizen(createCitizenDto);
  }

  @Put('citizens/:id')
  updateCitizen(
    @Param('id') id: string,
    @Body() updateCitizenDto: UpdateCitizenDto,
  ) {
    return this.adminProxyService.updateCitizen(id, updateCitizenDto);
  }

  @Delete('citizens/:id')
  deleteCitizen(@Param('id') id: string) {
    return this.adminProxyService.deleteCitizen(id);
  }

  @Get('families')
  findFamilies(@Query('search') search?: string) {
    return this.adminProxyService.findFamilies(search);
  }

  @Post('families')
  createFamily(@Body() createFamilyDto: CreateFamilyDto) {
    return this.adminProxyService.createFamily(createFamilyDto);
  }

  @Put('families/:id')
  updateFamily(
    @Param('id') id: string,
    @Body() updateFamilyDto: UpdateFamilyDto,
  ) {
    return this.adminProxyService.updateFamily(id, updateFamilyDto);
  }

  @Delete('families/:id')
  deleteFamily(@Param('id') id: string) {
    return this.adminProxyService.deleteFamily(id);
  }

  @Get('registrations/stats')
  getRegistrationStats() {
    return this.adminProxyService.getRegistrationStats();
  }

  @Post('uploads/disaster-cover')
  createDisasterCoverUploadUrl(
    @Body() createDisasterCoverUploadDto: CreateDisasterCoverUploadDto,
  ) {
    return this.adminProxyService.createDisasterCoverUploadUrl(
      createDisasterCoverUploadDto,
    );
  }

  @Post('uploads/incident-attachment')
  createIncidentAttachmentUploadUrl(
    @Body() createIncidentAttachmentUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    return this.adminProxyService.createIncidentAttachmentUploadUrl(
      createIncidentAttachmentUploadDto,
    );
  }

  @Post('uploads/view-url')
  createObjectViewUrl(@Body() createObjectViewUrlDto: CreateObjectViewUrlDto) {
    return this.adminProxyService.createObjectViewUrl(createObjectViewUrlDto);
  }

  @Get('check-ins')
  findCheckIns(@Query('search') search?: string) {
    return this.adminProxyService.findCheckIns(search);
  }

  @Get('check-ins/stats')
  getCheckInStats() {
    return this.adminProxyService.getCheckInStats();
  }

  @Get('check-ins/recent')
  getRecentCheckIns(@Query('limit') limit?: string) {
    return this.adminProxyService.getRecentCheckIns(
      limit ? Number.parseInt(limit, 10) : undefined,
    );
  }

  // ── User Management ───────────────────────────────────────────────────────

  @Get('users')
  findAllUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminProxyService.findAllUsers({ role, status, search });
  }

  @Get('users/:id')
  findUserById(@Param('id') id: string) {
    return this.adminProxyService.findUserById(id);
  }

  @Patch('users/:id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.adminProxyService.updateUserStatus(id, 'inactive');
  }

  @Patch('users/:id/activate')
  activateUser(@Param('id') id: string) {
    return this.adminProxyService.updateUserStatus(id, 'active');
  }

  @Patch('users/:id/role')
  changeUserRole(@Param('id') id: string, @Body('role') role: AppRole) {
    return this.adminProxyService.updateUserRole(id, role);
  }
}
