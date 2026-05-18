import { Inject, Injectable } from '@nestjs/common';
import { InventoryService } from '../../../src/inventory/inventory.service.js';
import { CapacityService } from '../../../src/capacity/capacity.service.js';
import { CheckInService } from '../../../src/check-in/check-in.service.js';
import { OrganizationsService } from '../../../src/organizations/organizations.service.js';
import { DisasterEventsService } from '../../../src/disaster-events/disaster-events.service.js';
import { DispatchOrdersService } from '../../../src/dispatch-orders/dispatch-orders.service.js';
import { ReliefOperationsService } from '../../../src/relief-operations/relief-operations.service.js';
import { IncidentReportsService } from '../../../src/incident-reports/incident-reports.service.js';
import { DistributionsService } from '../../../src/distributions/distributions.service.js';
import { RegistrationsService } from '../../../src/registrations/registrations.service.js';

@Injectable()
export class DashboardService {
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
  ) {}

  async getOverview(scope: 'admin' | 'site-manager') {
    const [
      inventory,
      capacity,
      checkIns,
      organizations,
      disasterEvents,
      dispatchOrders,
      reliefOperations,
      incidentReports,
      distributions,
      registrations,
    ] = await Promise.all([
      this.inventoryService.getStats(),
      this.capacityService.getStats(),
      this.checkInService.getStats(),
      this.organizationsService.getStats(),
      this.disasterEventsService.getStats(),
      this.dispatchOrdersService.getStats(),
      this.reliefOperationsService.getStats(),
      this.incidentReportsService.getStats(),
      this.distributionsService.getStats(),
      this.registrationsService.getStats(),
    ]);

    return {
      scope,
      generatedAt: new Date().toISOString(),
      inventory,
      capacity,
      checkIns,
      organizations,
      disasterEvents,
      dispatchOrders,
      reliefOperations,
      incidentReports,
      distributions,
      registrations,
    };
  }
}
