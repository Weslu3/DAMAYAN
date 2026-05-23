import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  CAPACITY_PATTERNS,
  CHECK_IN_PATTERNS,
  DASHBOARD_PATTERNS,
  DISASTER_EVENT_PATTERNS,
  DISPATCH_ORDER_PATTERNS,
  DISTRIBUTION_PATTERNS,
  INCIDENT_REPORT_PATTERNS,
  INVENTORY_PATTERNS,
  ORGANIZATION_PATTERNS,
  REGISTRATION_PATTERNS,
  RELIEF_OPERATION_PATTERNS,
  UPLOAD_PATTERNS,
} from '../../../libs/contracts/src/message-patterns.js';
import { CapacityService } from '../../../src/capacity/capacity.service.js';
import { CheckInService } from '../../../src/check-in/check-in.service.js';
import { CreateCheckInDto } from '../../../src/check-in/dto/create-check-in.dto.js';
import { ScanQrDto } from '../../../src/check-in/dto/scan-qr.dto.js';
import { DisasterEventsService } from '../../../src/disaster-events/disaster-events.service.js';
import { CreateDisasterEventDto } from '../../../src/disaster-events/dto/create-disaster-event.dto.js';
import { UpdateDisasterEventDto } from '../../../src/disaster-events/dto/update-disaster-event.dto.js';
import { CreateDispatchOrderDto } from '../../../src/dispatch-orders/dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from '../../../src/dispatch-orders/dto/update-dispatch-order.dto.js';
import { DispatchOrdersService } from '../../../src/dispatch-orders/dispatch-orders.service.js';
import { CreateDistributionDto } from '../../../src/distributions/dto/create-distribution.dto.js';
import { UpdateDistributionDto } from '../../../src/distributions/dto/update-distribution.dto.js';
import { DistributionsService } from '../../../src/distributions/distributions.service.js';
import { CreateIncidentReportDto } from '../../../src/incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../../src/incident-reports/dto/update-incident-report.dto.js';
import { IncidentReportsService } from '../../../src/incident-reports/incident-reports.service.js';
import { InventoryService } from '../../../src/inventory/inventory.service.js';
import { AdjustQuantityDto } from '../../../src/inventory/dto/adjust-quantity.dto.js';
import { CreateItemDto } from '../../../src/inventory/dto/create-item.dto.js';
import { UpdateItemDto } from '../../../src/inventory/dto/update-item.dto.js';
import { CreateOrganizationDto } from '../../../src/organizations/dto/create-organization.dto.js';
import { UpdateOrganizationDto } from '../../../src/organizations/dto/update-organization.dto.js';
import { OrganizationsService } from '../../../src/organizations/organizations.service.js';
import { CreateCitizenDto } from '../../../src/registrations/dto/create-citizen.dto.js';
import { CreateFamilyDto } from '../../../src/registrations/dto/create-family.dto.js';
import { UpdateCitizenDto } from '../../../src/registrations/dto/update-citizen.dto.js';
import { UpdateFamilyDto } from '../../../src/registrations/dto/update-family.dto.js';
import { RegistrationsService } from '../../../src/registrations/registrations.service.js';
import { CreateReliefOperationDto } from '../../../src/relief-operations/dto/create-relief-operation.dto.js';
import { UpdateReliefOperationDto } from '../../../src/relief-operations/dto/update-relief-operation.dto.js';
import { ReliefOperationsService } from '../../../src/relief-operations/relief-operations.service.js';
import { CreateDisasterCoverUploadDto } from '../../../src/uploads/dto/create-disaster-cover-upload.dto.js';
import { CreateIncidentAttachmentUploadDto } from '../../../src/uploads/dto/create-incident-attachment-upload.dto.js';
import { CreateObjectViewUrlDto } from '../../../src/uploads/dto/create-object-view-url.dto.js';
import { UploadsService } from '../../../src/uploads/uploads.service.js';
import { DashboardService } from './dashboard.service.js';

@Controller()
export class OperationsMessageController {
  constructor(
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(CapacityService) private readonly capacityService: CapacityService,
    @Inject(CheckInService) private readonly checkInService: CheckInService,
    @Inject(OrganizationsService)
    private readonly organizationsService: OrganizationsService,
    @Inject(DisasterEventsService)
    private readonly disasterEventsService: DisasterEventsService,
    @Inject(DispatchOrdersService)
    private readonly dispatchOrdersService: DispatchOrdersService,
    @Inject(ReliefOperationsService)
    private readonly reliefOperationsService: ReliefOperationsService,
    @Inject(IncidentReportsService)
    private readonly incidentReportsService: IncidentReportsService,
    @Inject(DistributionsService)
    private readonly distributionsService: DistributionsService,
    @Inject(RegistrationsService)
    private readonly registrationsService: RegistrationsService,
    @Inject(UploadsService) private readonly uploadsService: UploadsService,
    @Inject(DashboardService) private readonly dashboardService: DashboardService,
  ) {}

  @MessagePattern(INVENTORY_PATTERNS.FIND_ALL)
  findInventory(@Payload() payload: { search?: string }) {
    return this.inventoryService.findAll(payload?.search);
  }

  @MessagePattern(INVENTORY_PATTERNS.FIND_ONE)
  findInventoryItem(@Payload() payload: { id: string }) {
    return this.inventoryService.findOne(payload.id);
  }

  @MessagePattern(INVENTORY_PATTERNS.CREATE)
  createInventoryItem(@Payload() createItemDto: CreateItemDto) {
    return this.inventoryService.create(createItemDto);
  }

  @MessagePattern(INVENTORY_PATTERNS.UPDATE)
  updateInventoryItem(
    @Payload() payload: { id: string; updateItemDto: UpdateItemDto },
  ) {
    return this.inventoryService.update(payload.id, payload.updateItemDto);
  }

  @MessagePattern(INVENTORY_PATTERNS.ADJUST_QUANTITY)
  adjustInventoryItem(
    @Payload() payload: { id: string; adjustQuantityDto: AdjustQuantityDto },
  ) {
    return this.inventoryService.adjustQuantity(payload.id, payload.adjustQuantityDto);
  }

  @MessagePattern(INVENTORY_PATTERNS.DELETE)
  deleteInventoryItem(@Payload() payload: { id: string }) {
    return this.inventoryService.delete(payload.id);
  }

  @MessagePattern(INVENTORY_PATTERNS.GET_STATS)
  getInventoryStats() {
    return this.inventoryService.getStats();
  }

  @MessagePattern(CAPACITY_PATTERNS.FIND_ALL)
  findCapacity(@Payload() payload: { search?: string }) {
    return this.capacityService.findAll(payload?.search);
  }

  @MessagePattern(CAPACITY_PATTERNS.GET_STATS)
  getCapacityStats() {
    return this.capacityService.getStats();
  }

  @MessagePattern(ORGANIZATION_PATTERNS.FIND_ALL)
  findOrganizations(@Payload() payload: { search?: string }) {
    return this.organizationsService.findAll(payload?.search);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.FIND_ONE)
  findOrganization(@Payload() payload: { id: string }) {
    return this.organizationsService.findOne(payload.id);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.CREATE)
  createOrganization(@Payload() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.UPDATE)
  updateOrganization(
    @Payload() payload: { id: string; updateOrganizationDto: UpdateOrganizationDto },
  ) {
    return this.organizationsService.update(payload.id, payload.updateOrganizationDto);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.DELETE)
  deleteOrganization(@Payload() payload: { id: string }) {
    return this.organizationsService.delete(payload.id);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.GET_STATS)
  getOrganizationStats() {
    return this.organizationsService.getStats();
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.FIND_ALL)
  findDisasterEvents(@Payload() payload: { search?: string }) {
    return this.disasterEventsService.findAll(payload?.search);
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.FIND_ONE)
  findDisasterEvent(@Payload() payload: { id: string }) {
    return this.disasterEventsService.findOne(payload.id);
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.CREATE)
  createDisasterEvent(@Payload() createDisasterEventDto: CreateDisasterEventDto) {
    return this.disasterEventsService.create(createDisasterEventDto);
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.UPDATE)
  updateDisasterEvent(
    @Payload() payload: { id: string; updateDisasterEventDto: UpdateDisasterEventDto },
  ) {
    return this.disasterEventsService.update(payload.id, payload.updateDisasterEventDto);
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.DELETE)
  deleteDisasterEvent(@Payload() payload: { id: string }) {
    return this.disasterEventsService.delete(payload.id);
  }

  @MessagePattern(DISASTER_EVENT_PATTERNS.GET_STATS)
  getDisasterEventStats() {
    return this.disasterEventsService.getStats();
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.FIND_ALL)
  findDispatchOrders(@Payload() payload: { search?: string; operationId?: string; disasterId?: string }) {
    return this.dispatchOrdersService.findAll(payload?.search, payload?.operationId, payload?.disasterId);
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.FIND_ONE)
  findDispatchOrder(@Payload() payload: { id: string }) {
    return this.dispatchOrdersService.findOne(payload.id);
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.CREATE)
  createDispatchOrder(@Payload() createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.dispatchOrdersService.create(createDispatchOrderDto);
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.UPDATE)
  updateDispatchOrder(
    @Payload() payload: { id: string; updateDispatchOrderDto: UpdateDispatchOrderDto },
  ) {
    return this.dispatchOrdersService.update(payload.id, payload.updateDispatchOrderDto);
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.DELETE)
  deleteDispatchOrder(@Payload() payload: { id: string }) {
    return this.dispatchOrdersService.delete(payload.id);
  }

  @MessagePattern(DISPATCH_ORDER_PATTERNS.GET_STATS)
  getDispatchOrderStats() {
    return this.dispatchOrdersService.getStats();
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.FIND_ALL)
  findReliefOperations(@Payload() payload: { search?: string; disasterId?: string }) {
    return this.reliefOperationsService.findAll(payload?.search, payload?.disasterId);
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.FIND_ONE)
  findReliefOperation(@Payload() payload: { id: string }) {
    return this.reliefOperationsService.findOne(payload.id);
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.CREATE)
  createReliefOperation(@Payload() createReliefOperationDto: CreateReliefOperationDto) {
    return this.reliefOperationsService.create(createReliefOperationDto);
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.UPDATE)
  updateReliefOperation(
    @Payload() payload: { id: string; updateReliefOperationDto: UpdateReliefOperationDto },
  ) {
    return this.reliefOperationsService.update(payload.id, payload.updateReliefOperationDto);
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.DELETE)
  deleteReliefOperation(@Payload() payload: { id: string }) {
    return this.reliefOperationsService.delete(payload.id);
  }

  @MessagePattern(RELIEF_OPERATION_PATTERNS.GET_STATS)
  getReliefOperationStats() {
    return this.reliefOperationsService.getStats();
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.FIND_ALL)
  findIncidentReports(@Payload() payload: { search?: string; disasterId?: string }) {
    return this.incidentReportsService.findAll(payload?.search, payload?.disasterId);
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.FIND_ONE)
  findIncidentReport(@Payload() payload: { id: string }) {
    return this.incidentReportsService.findOne(payload.id);
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.CREATE)
  createIncidentReport(@Payload() createIncidentReportDto: CreateIncidentReportDto) {
    return this.incidentReportsService.create(createIncidentReportDto);
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.UPDATE)
  updateIncidentReport(
    @Payload() payload: { id: string; updateIncidentReportDto: UpdateIncidentReportDto },
  ) {
    return this.incidentReportsService.update(payload.id, payload.updateIncidentReportDto);
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.DELETE)
  deleteIncidentReport(@Payload() payload: { id: string }) {
    return this.incidentReportsService.delete(payload.id);
  }

  @MessagePattern(INCIDENT_REPORT_PATTERNS.GET_STATS)
  getIncidentReportStats() {
    return this.incidentReportsService.getStats();
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.FIND_ALL)
  findDistributions(@Payload() payload: { search?: string; operationId?: string }) {
    return this.distributionsService.findAll(payload?.search, payload?.operationId);
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.FIND_ONE)
  findDistribution(@Payload() payload: { id: string }) {
    return this.distributionsService.findOne(payload.id);
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.CREATE)
  createDistribution(@Payload() createDistributionDto: CreateDistributionDto) {
    return this.distributionsService.create(createDistributionDto);
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.UPDATE)
  updateDistribution(
    @Payload() payload: { id: string; updateDistributionDto: UpdateDistributionDto },
  ) {
    return this.distributionsService.update(payload.id, payload.updateDistributionDto);
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.DELETE)
  deleteDistribution(@Payload() payload: { id: string }) {
    return this.distributionsService.delete(payload.id);
  }

  @MessagePattern(DISTRIBUTION_PATTERNS.GET_STATS)
  getDistributionStats() {
    return this.distributionsService.getStats();
  }

  @MessagePattern(REGISTRATION_PATTERNS.FIND_CITIZENS)
  findCitizens(@Payload() payload: { search?: string }) {
    return this.registrationsService.findCitizens(payload?.search);
  }

  @MessagePattern(REGISTRATION_PATTERNS.FIND_CITIZEN)
  findCitizen(@Payload() payload: { id: string }) {
    return this.registrationsService.findCitizen(payload.id);
  }

  @MessagePattern(REGISTRATION_PATTERNS.CREATE_CITIZEN)
  createCitizen(@Payload() createCitizenDto: CreateCitizenDto) {
    return this.registrationsService.createCitizen(createCitizenDto);
  }

  @MessagePattern(REGISTRATION_PATTERNS.UPDATE_CITIZEN)
  updateCitizen(
    @Payload() payload: { id: string; updateCitizenDto: UpdateCitizenDto },
  ) {
    return this.registrationsService.updateCitizen(payload.id, payload.updateCitizenDto);
  }

  @MessagePattern(REGISTRATION_PATTERNS.DELETE_CITIZEN)
  deleteCitizen(@Payload() payload: { id: string }) {
    return this.registrationsService.deleteCitizen(payload.id);
  }

  @MessagePattern(REGISTRATION_PATTERNS.FIND_FAMILIES)
  findFamilies(@Payload() payload: { search?: string }) {
    return this.registrationsService.findFamilies(payload?.search);
  }

  @MessagePattern(REGISTRATION_PATTERNS.FIND_FAMILY)
  findFamily(@Payload() payload: { id: string }) {
    return this.registrationsService.findFamily(payload.id);
  }

  @MessagePattern(REGISTRATION_PATTERNS.CREATE_FAMILY)
  createFamily(@Payload() createFamilyDto: CreateFamilyDto) {
    return this.registrationsService.createFamily(createFamilyDto);
  }

  @MessagePattern(REGISTRATION_PATTERNS.UPDATE_FAMILY)
  updateFamily(
    @Payload() payload: { id: string; updateFamilyDto: UpdateFamilyDto },
  ) {
    return this.registrationsService.updateFamily(payload.id, payload.updateFamilyDto);
  }

  @MessagePattern(REGISTRATION_PATTERNS.DELETE_FAMILY)
  deleteFamily(@Payload() payload: { id: string }) {
    return this.registrationsService.deleteFamily(payload.id);
  }

  @MessagePattern(REGISTRATION_PATTERNS.GET_STATS)
  getRegistrationStats() {
    return this.registrationsService.getStats();
  }

  @MessagePattern(UPLOAD_PATTERNS.CREATE_DISASTER_COVER_UPLOAD_URL)
  createDisasterCoverUploadUrl(
    @Payload() createDisasterCoverUploadDto: CreateDisasterCoverUploadDto,
  ) {
    return this.uploadsService.createDisasterCoverUploadUrl(
      createDisasterCoverUploadDto,
    );
  }

  @MessagePattern(UPLOAD_PATTERNS.CREATE_INCIDENT_ATTACHMENT_UPLOAD_URL)
  createIncidentAttachmentUploadUrl(
    @Payload()
    createIncidentAttachmentUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    return this.uploadsService.createIncidentAttachmentUploadUrl(
      createIncidentAttachmentUploadDto,
    );
  }

  @MessagePattern(UPLOAD_PATTERNS.CREATE_OBJECT_VIEW_URL)
  createObjectViewUrl(@Payload() createObjectViewUrlDto: CreateObjectViewUrlDto) {
    return this.uploadsService.createObjectViewUrl(createObjectViewUrlDto);
  }

  @MessagePattern(CHECK_IN_PATTERNS.FIND_ALL)
  findCheckIns(@Payload() payload: { search?: string }) {
    return this.checkInService.findAll(payload?.search);
  }

  @MessagePattern(CHECK_IN_PATTERNS.FIND_ONE)
  findCheckIn(@Payload() payload: { id: string }) {
    return this.checkInService.findOne(payload.id);
  }

  @MessagePattern(CHECK_IN_PATTERNS.CREATE_MANUAL)
  async createManualCheckIn(@Payload() createCheckInDto: CreateCheckInDto) {
    try {
      return await this.checkInService.createManual(createCheckInDto);
    } catch (err: any) {
      throw new RpcException(err?.message ?? 'Check-in failed');
    }
  }

  @MessagePattern(CHECK_IN_PATTERNS.SCAN_QR)
  async scanQr(@Payload() scanQrDto: ScanQrDto) {
    try {
      return await this.checkInService.scanQr(scanQrDto);
    } catch (err: any) {
      throw new RpcException(err?.message ?? 'QR scan failed');
    }
  }

  @MessagePattern(CHECK_IN_PATTERNS.CHECK_OUT)
  async checkOut(@Payload() payload: { id: string }) {
    try {
      return await this.checkInService.checkOut(payload.id);
    } catch (err: any) {
      throw new RpcException(err?.message ?? 'Check-out failed');
    }
  }

  @MessagePattern(CHECK_IN_PATTERNS.GET_STATS)
  getCheckInStats() {
    return this.checkInService.getStats();
  }

  @MessagePattern(CHECK_IN_PATTERNS.GET_RECENT)
  getRecentCheckIns(@Payload() payload: { limit?: number }) {
    return this.checkInService.getRecent(payload?.limit);
  }

  @MessagePattern(DASHBOARD_PATTERNS.GET_OVERVIEW)
  getDashboardOverview(@Payload() payload: { scope?: 'admin' | 'site-manager' }) {
    return this.dashboardService.getOverview(payload?.scope ?? 'site-manager');
  }
}
