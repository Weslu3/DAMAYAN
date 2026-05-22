import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { SiteManagerProxyService } from './site-manager.proxy.service.js';
import { UpsertAfterActionAssessmentDto } from './dto/upsert-after-action-assessment.dto.js';
import { CreateItemDto } from '../../inventory/dto/create-item.dto.js';
import { UpdateItemDto } from '../../inventory/dto/update-item.dto.js';
import { AdjustQuantityDto } from '../../inventory/dto/adjust-quantity.dto.js';
import { CreateCheckInDto } from '../../check-in/dto/create-check-in.dto.js';
import { ScanQrDto } from '../../check-in/dto/scan-qr.dto.js';
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
import { CreateIncidentAttachmentUploadDto } from '../../uploads/dto/create-incident-attachment-upload.dto.js';
import { CreateObjectViewUrlDto } from '../../uploads/dto/create-object-view-url.dto.js';
import { ApiCenterService } from '../../apicenter/apicenter.service.js';

@Controller('site-manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.LINE_MANAGER)
export class SiteManagerController {
  constructor(
    @Inject(SiteManagerProxyService) private readonly siteManagerProxyService: SiteManagerProxyService,
    @Inject(ApiCenterService) private readonly apiCenterService: ApiCenterService,
  ) {}

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

  @Get('dashboard')
  getDashboard() {
    return this.siteManagerProxyService.getDashboard();
  }

  @Get('after-action-assessment/latest')
  getLatestAfterActionAssessment(@Query('disasterId') disasterId?: string) {
    return this.siteManagerProxyService.getLatestAfterActionAssessment(disasterId);
  }

  @Put('after-action-assessment')
  upsertAfterActionAssessment(@Body() payload: UpsertAfterActionAssessmentDto) {
    return this.siteManagerProxyService.upsertAfterActionAssessment(payload);
  }

  @Get('inventory')
  findInventory(@Query('search') search?: string) {
    return this.siteManagerProxyService.findInventory(search);
  }

  @Get('inventory/stats')
  getInventoryStats() {
    return this.siteManagerProxyService.getInventoryStats();
  }

  @Get('inventory/:id')
  findInventoryItem(@Param('id') id: string) {
    return this.siteManagerProxyService.findInventoryItem(id);
  }

  @Post('inventory')
  createInventoryItem(@Body() createItemDto: CreateItemDto) {
    return this.siteManagerProxyService.createInventoryItem(createItemDto);
  }

  @Put('inventory/:id')
  updateInventoryItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.siteManagerProxyService.updateInventoryItem(id, updateItemDto);
  }

  @Patch('inventory/:id/adjust')
  adjustInventoryItem(
    @Param('id') id: string,
    @Body() adjustQuantityDto: AdjustQuantityDto,
  ) {
    return this.siteManagerProxyService.adjustInventoryItem(id, adjustQuantityDto);
  }

  @Delete('inventory/:id')
  deleteInventoryItem(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteInventoryItem(id);
  }

  @Post('inventory/receive')
  receiveInventory(
    @Body()
    payload: {
      itemIds: string[];
      quantities: number[];
      arrivalTerminal?: string;
      waybillNumber?: string;
      condition?: string;
    },
  ) {
    return this.siteManagerProxyService.receiveInventory(payload);
  }

  @Post('inventory/batch')
  createInventoryBatch(
    @Body()
    payload: {
      name?: string;
      items: Array<{ itemId: string; quantity: number }>;
    },
  ) {
    return this.siteManagerProxyService.createInventoryBatch(payload);
  }

  @Get('capacity')
  findCapacity(@Query('search') search?: string) {
    return this.siteManagerProxyService.findCapacity(search);
  }

  @Get('capacity/stats')
  getCapacityStats() {
    return this.siteManagerProxyService.getCapacityStats();
  }

  @Get('organizations')
  findOrganizations(@Query('search') search?: string) {
    return this.siteManagerProxyService.findOrganizations(search);
  }

  @Get('organizations/stats')
  getOrganizationStats() {
    return this.siteManagerProxyService.getOrganizationStats();
  }

  @Get('disaster-events')
  findDisasterEvents(@Query('search') search?: string) {
    return this.siteManagerProxyService.findDisasterEvents(search);
  }

  @Get('disaster-events/stats')
  getDisasterEventStats() {
    return this.siteManagerProxyService.getDisasterEventStats();
  }

  @Get('dispatch-orders')
  findDispatchOrders(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.siteManagerProxyService.findDispatchOrders(search, operationId, disasterId);
  }

  @Get('dispatch-orders/stats')
  getDispatchOrderStats() {
    return this.siteManagerProxyService.getDispatchOrderStats();
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.siteManagerProxyService.createDispatchOrder(createDispatchOrderDto);
  }

  @Put('dispatch-orders/:id')
  updateDispatchOrder(
    @Param('id') id: string,
    @Body() updateDispatchOrderDto: UpdateDispatchOrderDto,
  ) {
    return this.siteManagerProxyService.updateDispatchOrder(id, updateDispatchOrderDto);
  }

  @Delete('dispatch-orders/:id')
  deleteDispatchOrder(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteDispatchOrder(id);
  }

  @Get('relief-operations')
  findReliefOperations(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.siteManagerProxyService.findReliefOperations(search, disasterId);
  }

  @Get('relief-operations/stats')
  getReliefOperationStats() {
    return this.siteManagerProxyService.getReliefOperationStats();
  }

  @Post('relief-operations')
  createReliefOperation(@Body() createReliefOperationDto: CreateReliefOperationDto) {
    return this.siteManagerProxyService.createReliefOperation(createReliefOperationDto);
  }

  @Put('relief-operations/:id')
  updateReliefOperation(
    @Param('id') id: string,
    @Body() updateReliefOperationDto: UpdateReliefOperationDto,
  ) {
    return this.siteManagerProxyService.updateReliefOperation(id, updateReliefOperationDto);
  }

  @Delete('relief-operations/:id')
  deleteReliefOperation(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteReliefOperation(id);
  }

  @Get('incident-reports')
  findIncidentReports(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.siteManagerProxyService.findIncidentReports(search, disasterId);
  }

  @Get('incident-reports/stats')
  getIncidentReportStats() {
    return this.siteManagerProxyService.getIncidentReportStats();
  }

  @Post('incident-reports')
  createIncidentReport(@Body() createIncidentReportDto: CreateIncidentReportDto) {
    return this.siteManagerProxyService.createIncidentReport(createIncidentReportDto);
  }

  @Put('incident-reports/:id')
  updateIncidentReport(
    @Param('id') id: string,
    @Body() updateIncidentReportDto: UpdateIncidentReportDto,
  ) {
    return this.siteManagerProxyService.updateIncidentReport(id, updateIncidentReportDto);
  }

  @Delete('incident-reports/:id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteIncidentReport(id);
  }

  @Get('distributions')
  findDistributions(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.siteManagerProxyService.findDistributions(search, operationId);
  }

  @Get('distributions/stats')
  getDistributionStats() {
    return this.siteManagerProxyService.getDistributionStats();
  }

  @Post('distributions')
  createDistribution(@Body() createDistributionDto: CreateDistributionDto) {
    return this.siteManagerProxyService.createDistribution(createDistributionDto);
  }

  @Put('distributions/:id')
  updateDistribution(
    @Param('id') id: string,
    @Body() updateDistributionDto: UpdateDistributionDto,
  ) {
    return this.siteManagerProxyService.updateDistribution(id, updateDistributionDto);
  }

  @Delete('distributions/:id')
  deleteDistribution(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteDistribution(id);
  }

  @Get('citizens')
  findCitizens(@Query('search') search?: string) {
    return this.siteManagerProxyService.findCitizens(search);
  }

  @Post('citizens')
  createCitizen(@Body() createCitizenDto: CreateCitizenDto) {
    return this.siteManagerProxyService.createCitizen(createCitizenDto);
  }

  @Put('citizens/:id')
  updateCitizen(
    @Param('id') id: string,
    @Body() updateCitizenDto: UpdateCitizenDto,
  ) {
    return this.siteManagerProxyService.updateCitizen(id, updateCitizenDto);
  }

  @Delete('citizens/:id')
  deleteCitizen(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteCitizen(id);
  }

  @Get('families')
  findFamilies(@Query('search') search?: string) {
    return this.siteManagerProxyService.findFamilies(search);
  }

  @Post('families')
  createFamily(@Body() createFamilyDto: CreateFamilyDto) {
    return this.siteManagerProxyService.createFamily(createFamilyDto);
  }

  @Put('families/:id')
  updateFamily(
    @Param('id') id: string,
    @Body() updateFamilyDto: UpdateFamilyDto,
  ) {
    return this.siteManagerProxyService.updateFamily(id, updateFamilyDto);
  }

  @Delete('families/:id')
  deleteFamily(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteFamily(id);
  }

  @Get('registrations/stats')
  getRegistrationStats() {
    return this.siteManagerProxyService.getRegistrationStats();
  }

  @Post('uploads/incident-attachment')
  createIncidentAttachmentUploadUrl(
    @Body() createIncidentAttachmentUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    return this.siteManagerProxyService.createIncidentAttachmentUploadUrl(
      createIncidentAttachmentUploadDto,
    );
  }

  @Post('uploads/view-url')
  createObjectViewUrl(@Body() createObjectViewUrlDto: CreateObjectViewUrlDto) {
    return this.siteManagerProxyService.createObjectViewUrl(createObjectViewUrlDto);
  }

  @Get('check-ins')
  findCheckIns(@Query('search') search?: string) {
    return this.siteManagerProxyService.findCheckIns(search);
  }

  @Get('check-ins/stats')
  getCheckInStats() {
    return this.siteManagerProxyService.getCheckInStats();
  }

  @Get('check-ins/recent')
  getRecentCheckIns(@Query('limit') limit?: string) {
    return this.siteManagerProxyService.getRecentCheckIns(
      limit ? Number.parseInt(limit, 10) : undefined,
    );
  }

  @Get('check-ins/:id')
  findCheckIn(@Param('id') id: string) {
    return this.siteManagerProxyService.findCheckIn(id);
  }

  @Post('check-ins/manual')
  createManualCheckIn(@Body() createCheckInDto: CreateCheckInDto) {
    return this.siteManagerProxyService.createManualCheckIn(createCheckInDto);
  }

  @Post('check-ins/scan')
  scanQr(@Body() scanQrDto: ScanQrDto) {
    return this.siteManagerProxyService.scanQr(scanQrDto);
  }

  @Patch('check-ins/:id/checkout')
  checkOut(@Param('id') id: string) {
    return this.siteManagerProxyService.checkOut(id);
  }

  @Post('operations/close')
  closeOperations() {
    return this.siteManagerProxyService.closeOperations();
  }

  @Post('reports/summary')
  generateSiteSummaryReport() {
    return this.siteManagerProxyService.generateSiteSummaryReport();
  }
}
