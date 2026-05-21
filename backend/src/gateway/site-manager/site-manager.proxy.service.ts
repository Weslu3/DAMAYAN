import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
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
import { OPERATIONS_SERVICE } from '../gateway.tokens.js';
import { CreateItemDto } from '../../inventory/dto/create-item.dto.js';
import { UpsertAfterActionAssessmentDto } from './dto/upsert-after-action-assessment.dto.js';
import { UpdateItemDto } from '../../inventory/dto/update-item.dto.js';
import { AdjustQuantityDto } from '../../inventory/dto/adjust-quantity.dto.js';
import { CreateCheckInDto } from '../../check-in/dto/create-check-in.dto.js';
import { ScanQrDto } from '../../check-in/dto/scan-qr.dto.js';
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

const AFTER_ACTION_ASSESSMENT_TITLE = 'After-Action Assessment';
const AFTER_ACTION_ASSESSMENT_LOCATION = 'Site Manager Post-Disaster Evaluation';

interface IncidentReportRecord {
  id: string;
  disasterId: string;
  reportedBy: string;
  title: string;
  content: string;
  severity: string;
  location: string;
  status: string;
  createdAt: string;
}

interface AfterActionAssessmentContent {
  infraStatus: string;
  estimatedCost: number;
  reliefNeeded: number;
  durationDays: number;
  shelterRating: number;
  successNotes: string;
  bottlenecks: string;
  submittedBy?: string;
  submittedAt?: string;
}

function parseAfterActionAssessmentContent(content: string): AfterActionAssessmentContent {
  try {
    return JSON.parse(content) as AfterActionAssessmentContent;
  } catch {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const values = Object.fromEntries(
      lines
        .map((line) => {
          const separatorIndex = line.indexOf(':');
          if (separatorIndex < 0) return null;
          const key = line.slice(0, separatorIndex).trim().toLowerCase();
          const value = line.slice(separatorIndex + 1).trim();
          return [key, value] as const;
        })
        .filter((entry): entry is readonly [string, string] => entry !== null),
    );

    return {
      infraStatus: values['infrastructure status'] || values['infra status'] || '',
      estimatedCost: Number(values['estimated financial damage (php)'] || values['estimated cost'] || 0),
      reliefNeeded: Number(values['relief kits required'] || 0),
      durationDays: Number(values['est. rebuilding duration (days)'] || values['duration days'] || 0),
      shelterRating: (() => {
        const ratingText = values['evacuation shelter performance rating'] || values['shelter rating'] || '';
        const match = /\((\d+)\s*\/\s*5/.exec(ratingText);
        return Number(match?.[1] ?? ratingText ?? 1);
      })(),
      successNotes: values['operational successes summary'] || '',
      bottlenecks: values['challenges / staging bottlenecks'] || values['challenges and staging bottlenecks'] || '',
      submittedBy: values['submitted by'],
      submittedAt: values['submitted at'],
    };
  }
}

function formatAfterActionAssessmentContent(payload: AfterActionAssessmentContent) {
  return [
    `Infrastructure Status: ${payload.infraStatus}`,
    `Estimated Financial Damage (PHP): ${payload.estimatedCost}`,
    `Relief Kits Required: ${payload.reliefNeeded}`,
    `Est. Rebuilding Duration (Days): ${payload.durationDays}`,
    `Evacuation Shelter Performance Rating: ${payload.shelterRating} / 5`,
    `Operational Successes Summary: ${payload.successNotes}`,
    `Challenges / Staging Bottlenecks: ${payload.bottlenecks}`,
    payload.submittedBy ? `Submitted By: ${payload.submittedBy}` : null,
    payload.submittedAt ? `Submitted At: ${payload.submittedAt}` : null,
  ].filter(Boolean).join('\n');
}

@Injectable()
export class SiteManagerProxyService {
  constructor(
    @Inject(OPERATIONS_SERVICE) private readonly operationsClient: ClientProxy,
  ) {}

  getDashboard(scope: 'admin' | 'site-manager' = 'site-manager') {
    return firstValueFrom(
      this.operationsClient.send(DASHBOARD_PATTERNS.GET_OVERVIEW, {
        scope,
      }),
    );
  }

  getLatestAfterActionAssessment(disasterId?: string) {
    return this.findIncidentReports(undefined, disasterId).then((reports) => {
      const parsed = (reports as IncidentReportRecord[])
        .filter((report) => report.title === AFTER_ACTION_ASSESSMENT_TITLE)
        .map((report) => {
          try {
              const content = parseAfterActionAssessmentContent(report.content);
            return {
              id: report.id,
              disasterId: report.disasterId,
              infraStatus: content.infraStatus,
              estimatedCost: Number(content.estimatedCost ?? 0),
              reliefNeeded: Number(content.reliefNeeded ?? 0),
              durationDays: Number(content.durationDays ?? 0),
              shelterRating: Number(content.shelterRating ?? 1),
              successNotes: content.successNotes ?? '',
              bottlenecks: content.bottlenecks ?? '',
              submittedBy: content.submittedBy ?? report.reportedBy,
              submittedAt: content.submittedAt ?? report.createdAt,
              updatedAt: report.createdAt,
            };
          } catch {
            return null;
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return parsed[0] ?? null;
    });
  }

  upsertAfterActionAssessment(payload: UpsertAfterActionAssessmentDto) {
    const content: AfterActionAssessmentContent = {
      infraStatus: payload.infraStatus,
      estimatedCost: payload.estimatedCost,
      reliefNeeded: payload.reliefNeeded,
      durationDays: payload.durationDays,
      shelterRating: payload.shelterRating,
      successNotes: payload.successNotes,
      bottlenecks: payload.bottlenecks,
      submittedBy: payload.submittedBy,
      submittedAt: new Date().toISOString(),
    };
    const storedContent = formatAfterActionAssessmentContent(content);

    return this.findIncidentReports(undefined, payload.disasterId).then(async (reports) => {
      const existing = (reports as IncidentReportRecord[]).find(
        (report) => report.title === AFTER_ACTION_ASSESSMENT_TITLE,
      );

      if (existing) {
        return firstValueFrom(
          this.operationsClient.send(INCIDENT_REPORT_PATTERNS.UPDATE, {
            id: existing.id,
            updateIncidentReportDto: {
              content: storedContent,
              status: 'reviewed',
            },
          }),
        ).then(() => this.getLatestAfterActionAssessment(payload.disasterId));
      }

      return firstValueFrom(
        this.operationsClient.send(INCIDENT_REPORT_PATTERNS.CREATE, {
          disasterId: payload.disasterId,
          reportedBy: payload.submittedBy ?? 'System',
          title: AFTER_ACTION_ASSESSMENT_TITLE,
          content: storedContent,
          severity: 'moderate',
          location: AFTER_ACTION_ASSESSMENT_LOCATION,
          status: 'reviewed',
        }),
      ).then(() => this.getLatestAfterActionAssessment(payload.disasterId));
    });
  }

  findInventory(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.FIND_ALL, { search }),
    );
  }

  findInventoryItem(id: string) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.FIND_ONE, { id }),
    );
  }

  createInventoryItem(createItemDto: CreateItemDto) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.CREATE, createItemDto),
    );
  }

  updateInventoryItem(id: string, updateItemDto: UpdateItemDto) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.UPDATE, { id, updateItemDto }),
    );
  }

  adjustInventoryItem(id: string, adjustQuantityDto: AdjustQuantityDto) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.ADJUST_QUANTITY, {
        id,
        adjustQuantityDto,
      }),
    );
  }

  deleteInventoryItem(id: string) {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.DELETE, { id }),
    );
  }

  getInventoryStats() {
    return firstValueFrom(
      this.operationsClient.send(INVENTORY_PATTERNS.GET_STATS, {}),
    );
  }

  findCapacity(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(CAPACITY_PATTERNS.FIND_ALL, { search }),
    );
  }

  getCapacityStats() {
    return firstValueFrom(
      this.operationsClient.send(CAPACITY_PATTERNS.GET_STATS, {}),
    );
  }

  findOrganizations(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(ORGANIZATION_PATTERNS.FIND_ALL, { search }),
    );
  }

  createOrganization(createOrganizationDto: CreateOrganizationDto) {
    return firstValueFrom(
      this.operationsClient.send(ORGANIZATION_PATTERNS.CREATE, createOrganizationDto),
    );
  }

  updateOrganization(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    return firstValueFrom(
      this.operationsClient.send(ORGANIZATION_PATTERNS.UPDATE, {
        id,
        updateOrganizationDto,
      }),
    );
  }

  deleteOrganization(id: string) {
    return firstValueFrom(
      this.operationsClient.send(ORGANIZATION_PATTERNS.DELETE, { id }),
    );
  }

  getOrganizationStats() {
    return firstValueFrom(
      this.operationsClient.send(ORGANIZATION_PATTERNS.GET_STATS, {}),
    );
  }

  findDisasterEvents(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(DISASTER_EVENT_PATTERNS.FIND_ALL, { search }),
    );
  }

  createDisasterEvent(createDisasterEventDto: CreateDisasterEventDto) {
    return firstValueFrom(
      this.operationsClient.send(DISASTER_EVENT_PATTERNS.CREATE, createDisasterEventDto),
    );
  }

  updateDisasterEvent(id: string, updateDisasterEventDto: UpdateDisasterEventDto) {
    return firstValueFrom(
      this.operationsClient.send(DISASTER_EVENT_PATTERNS.UPDATE, {
        id,
        updateDisasterEventDto,
      }),
    );
  }

  deleteDisasterEvent(id: string) {
    return firstValueFrom(
      this.operationsClient.send(DISASTER_EVENT_PATTERNS.DELETE, { id }),
    );
  }

  getDisasterEventStats() {
    return firstValueFrom(
      this.operationsClient.send(DISASTER_EVENT_PATTERNS.GET_STATS, {}),
    );
  }

  findDispatchOrders(search?: string, operationId?: string) {
    return firstValueFrom(
      this.operationsClient.send(DISPATCH_ORDER_PATTERNS.FIND_ALL, {
        search,
        operationId,
      }),
    );
  }

  createDispatchOrder(createDispatchOrderDto: CreateDispatchOrderDto) {
    return firstValueFrom(
      this.operationsClient.send(DISPATCH_ORDER_PATTERNS.CREATE, createDispatchOrderDto),
    );
  }

  updateDispatchOrder(id: string, updateDispatchOrderDto: UpdateDispatchOrderDto) {
    return firstValueFrom(
      this.operationsClient.send(DISPATCH_ORDER_PATTERNS.UPDATE, {
        id,
        updateDispatchOrderDto,
      }),
    );
  }

  deleteDispatchOrder(id: string) {
    return firstValueFrom(
      this.operationsClient.send(DISPATCH_ORDER_PATTERNS.DELETE, { id }),
    );
  }

  getDispatchOrderStats() {
    return firstValueFrom(
      this.operationsClient.send(DISPATCH_ORDER_PATTERNS.GET_STATS, {}),
    );
  }

  findReliefOperations(search?: string, disasterId?: string) {
    return firstValueFrom(
      this.operationsClient.send(RELIEF_OPERATION_PATTERNS.FIND_ALL, {
        search,
        disasterId,
      }),
    );
  }

  createReliefOperation(createReliefOperationDto: CreateReliefOperationDto) {
    return firstValueFrom(
      this.operationsClient.send(RELIEF_OPERATION_PATTERNS.CREATE, createReliefOperationDto),
    );
  }

  updateReliefOperation(id: string, updateReliefOperationDto: UpdateReliefOperationDto) {
    return firstValueFrom(
      this.operationsClient.send(RELIEF_OPERATION_PATTERNS.UPDATE, {
        id,
        updateReliefOperationDto,
      }),
    );
  }

  deleteReliefOperation(id: string) {
    return firstValueFrom(
      this.operationsClient.send(RELIEF_OPERATION_PATTERNS.DELETE, { id }),
    );
  }

  getReliefOperationStats() {
    return firstValueFrom(
      this.operationsClient.send(RELIEF_OPERATION_PATTERNS.GET_STATS, {}),
    );
  }

  findIncidentReports(search?: string, disasterId?: string) {
    return firstValueFrom(
      this.operationsClient.send(INCIDENT_REPORT_PATTERNS.FIND_ALL, {
        search,
        disasterId,
      }),
    );
  }

  createIncidentReport(createIncidentReportDto: CreateIncidentReportDto) {
    return firstValueFrom(
      this.operationsClient.send(INCIDENT_REPORT_PATTERNS.CREATE, createIncidentReportDto),
    );
  }

  updateIncidentReport(id: string, updateIncidentReportDto: UpdateIncidentReportDto) {
    return firstValueFrom(
      this.operationsClient.send(INCIDENT_REPORT_PATTERNS.UPDATE, {
        id,
        updateIncidentReportDto,
      }),
    );
  }

  deleteIncidentReport(id: string) {
    return firstValueFrom(
      this.operationsClient.send(INCIDENT_REPORT_PATTERNS.DELETE, { id }),
    );
  }

  getIncidentReportStats() {
    return firstValueFrom(
      this.operationsClient.send(INCIDENT_REPORT_PATTERNS.GET_STATS, {}),
    );
  }

  findDistributions(search?: string, operationId?: string) {
    return firstValueFrom(
      this.operationsClient.send(DISTRIBUTION_PATTERNS.FIND_ALL, {
        search,
        operationId,
      }),
    );
  }

  createDistribution(createDistributionDto: CreateDistributionDto) {
    return firstValueFrom(
      this.operationsClient.send(DISTRIBUTION_PATTERNS.CREATE, createDistributionDto),
    );
  }

  updateDistribution(id: string, updateDistributionDto: UpdateDistributionDto) {
    return firstValueFrom(
      this.operationsClient.send(DISTRIBUTION_PATTERNS.UPDATE, {
        id,
        updateDistributionDto,
      }),
    );
  }

  deleteDistribution(id: string) {
    return firstValueFrom(
      this.operationsClient.send(DISTRIBUTION_PATTERNS.DELETE, { id }),
    );
  }

  getDistributionStats() {
    return firstValueFrom(
      this.operationsClient.send(DISTRIBUTION_PATTERNS.GET_STATS, {}),
    );
  }

  findCitizens(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.FIND_CITIZENS, { search }),
    );
  }

  createCitizen(createCitizenDto: CreateCitizenDto) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.CREATE_CITIZEN, createCitizenDto),
    );
  }

  updateCitizen(id: string, updateCitizenDto: UpdateCitizenDto) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.UPDATE_CITIZEN, {
        id,
        updateCitizenDto,
      }),
    );
  }

  deleteCitizen(id: string) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.DELETE_CITIZEN, { id }),
    );
  }

  findFamilies(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.FIND_FAMILIES, { search }),
    );
  }

  createFamily(createFamilyDto: CreateFamilyDto) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.CREATE_FAMILY, createFamilyDto),
    );
  }

  updateFamily(id: string, updateFamilyDto: UpdateFamilyDto) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.UPDATE_FAMILY, {
        id,
        updateFamilyDto,
      }),
    );
  }

  deleteFamily(id: string) {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.DELETE_FAMILY, { id }),
    );
  }

  getRegistrationStats() {
    return firstValueFrom(
      this.operationsClient.send(REGISTRATION_PATTERNS.GET_STATS, {}),
    );
  }

  createDisasterCoverUploadUrl(
    createDisasterCoverUploadDto: CreateDisasterCoverUploadDto,
  ) {
    return firstValueFrom(
      this.operationsClient.send(
        UPLOAD_PATTERNS.CREATE_DISASTER_COVER_UPLOAD_URL,
        createDisasterCoverUploadDto,
      ),
    );
  }

  createIncidentAttachmentUploadUrl(
    createIncidentAttachmentUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    return firstValueFrom(
      this.operationsClient.send(
        UPLOAD_PATTERNS.CREATE_INCIDENT_ATTACHMENT_UPLOAD_URL,
        createIncidentAttachmentUploadDto,
      ),
    );
  }

  createObjectViewUrl(createObjectViewUrlDto: CreateObjectViewUrlDto) {
    return firstValueFrom(
      this.operationsClient.send(
        UPLOAD_PATTERNS.CREATE_OBJECT_VIEW_URL,
        createObjectViewUrlDto,
      ),
    );
  }

  findCheckIns(search?: string) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.FIND_ALL, { search }),
    );
  }

  findCheckIn(id: string) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.FIND_ONE, { id }),
    );
  }

  createManualCheckIn(createCheckInDto: CreateCheckInDto) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.CREATE_MANUAL, createCheckInDto),
    ).catch((err: any) => {
      const msg = typeof err === 'string' ? err : (err?.message ?? err?.error ?? 'Check-in failed');
      throw new BadRequestException(msg);
    });
  }

  scanQr(scanQrDto: ScanQrDto) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.SCAN_QR, scanQrDto),
    );
  }

  checkOut(id: string) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.CHECK_OUT, { id }),
    );
  }

  getCheckInStats() {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.GET_STATS, {}),
    );
  }

  getRecentCheckIns(limit?: number) {
    return firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.GET_RECENT, { limit }),
    );
  }

  async receiveInventory(payload: {
    itemIds: string[];
    quantities: number[];
    arrivalTerminal?: string;
    waybillNumber?: string;
    condition?: string;
  }) {
    const itemIds = payload.itemIds ?? [];
    const quantities = payload.quantities ?? [];

    if (itemIds.length === 0) {
      throw new BadRequestException('At least one inventory item is required');
    }

    if (itemIds.length !== quantities.length) {
      throw new BadRequestException('itemIds and quantities must have matching lengths');
    }

    const updatedItems = await Promise.all(
      itemIds.map((id, index) => {
        const adjustment = Number(quantities[index] ?? 0);
        if (!Number.isFinite(adjustment) || adjustment <= 0) {
          throw new BadRequestException('All received quantities must be positive numbers');
        }

        return firstValueFrom(
          this.operationsClient.send(INVENTORY_PATTERNS.ADJUST_QUANTITY, {
            id,
            adjustQuantityDto: { adjustment },
          }),
        );
      }),
    );

    return {
      ok: true,
      receivedAt: new Date().toISOString(),
      arrivalTerminal: payload.arrivalTerminal ?? null,
      waybillNumber: payload.waybillNumber ?? null,
      condition: payload.condition ?? 'Intact',
      updatedItems,
    };
  }

  async createInventoryBatch(payload: {
    name?: string;
    items: Array<{ itemId: string; quantity: number }>;
  }) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new BadRequestException('Batch must include at least one item');
    }

    const batchName = payload.name?.trim() || `Batch-${new Date().toISOString()}`;

    const updatedItems = await Promise.all(
      payload.items.map((item) => {
        const adjustment = Number(item.quantity ?? 0);
        if (!item.itemId || !Number.isFinite(adjustment) || adjustment <= 0) {
          throw new BadRequestException('Each batch item must have a valid itemId and positive quantity');
        }

        return firstValueFrom(
          this.operationsClient.send(INVENTORY_PATTERNS.ADJUST_QUANTITY, {
            id: item.itemId,
            adjustQuantityDto: { adjustment },
          }),
        );
      }),
    );

    return {
      ok: true,
      batchName,
      createdAt: new Date().toISOString(),
      itemCount: payload.items.length,
      updatedItems,
    };
  }

  async closeOperations() {
    const checkIns = await firstValueFrom(
      this.operationsClient.send(CHECK_IN_PATTERNS.FIND_ALL, {}),
    );

    const activeCheckIns = checkIns.filter((entry) => entry.status === 'checked-in');
    const checkoutResults = await Promise.allSettled(
      activeCheckIns.map((entry) =>
        firstValueFrom(this.operationsClient.send(CHECK_IN_PATTERNS.CHECK_OUT, { id: entry.id })),
      ),
    );

    const succeeded = checkoutResults.filter((result) => result.status === 'fulfilled').length;
    const failed = checkoutResults.length - succeeded;

    return {
      ok: failed === 0,
      closedAt: new Date().toISOString(),
      totalActiveBeforeClose: activeCheckIns.length,
      checkedOutCount: succeeded,
      failedCount: failed,
    };
  }

  async generateSiteSummaryReport() {
    const [dashboard, inventoryStats, checkInStats, incidentStats] = await Promise.all([
      firstValueFrom(this.operationsClient.send(DASHBOARD_PATTERNS.GET_OVERVIEW, { scope: 'site-manager' })),
      firstValueFrom(this.operationsClient.send(INVENTORY_PATTERNS.GET_STATS, {})),
      firstValueFrom(this.operationsClient.send(CHECK_IN_PATTERNS.GET_STATS, {})),
      firstValueFrom(this.operationsClient.send(INCIDENT_REPORT_PATTERNS.GET_STATS, {})),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      type: 'site-summary',
      dashboard,
      inventoryStats,
      checkInStats,
      incidentStats,
    };
  }
}
