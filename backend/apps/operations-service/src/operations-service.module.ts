import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CapacityModule } from '../../../src/capacity/capacity.module.js';
import { CheckInModule } from '../../../src/check-in/check-in.module.js';
import { DisasterEventsModule } from '../../../src/disaster-events/disaster-events.module.js';
import { DispatchOrdersModule } from '../../../src/dispatch-orders/dispatch-orders.module.js';
import { DistributionsModule } from '../../../src/distributions/distributions.module.js';
import { IncidentReportsModule } from '../../../src/incident-reports/incident-reports.module.js';
import { InventoryModule } from '../../../src/inventory/inventory.module.js';
import { OrganizationsModule } from '../../../src/organizations/organizations.module.js';
import { RegistrationsModule } from '../../../src/registrations/registrations.module.js';
import { ReliefOperationsModule } from '../../../src/relief-operations/relief-operations.module.js';
import { UploadsModule } from '../../../src/uploads/uploads.module.js';
import { OperationsMessageController } from './operations-message.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InventoryModule,
    CapacityModule,
    CheckInModule,
    OrganizationsModule,
    DisasterEventsModule,
    DispatchOrdersModule,
    ReliefOperationsModule,
    IncidentReportsModule,
    DistributionsModule,
    RegistrationsModule,
    UploadsModule,
  ],
  controllers: [OperationsMessageController],
  providers: [DashboardService],
})
export class OperationsServiceAppModule {}
