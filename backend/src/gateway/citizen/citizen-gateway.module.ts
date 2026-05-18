import { Module } from '@nestjs/common';
import { CitizenController } from './citizen.controller.js';
import { RegistrationsModule } from '../../registrations/registrations.module.js';
import { IncidentReportsModule } from '../../incident-reports/incident-reports.module.js';
import { DisasterEventsModule } from '../../disaster-events/disaster-events.module.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';

@Module({
  imports: [
    RegistrationsModule,
    IncidentReportsModule,
    DisasterEventsModule,
  ],
  controllers: [CitizenController],
  providers: [JwtAuthGuard, RolesGuard],
})
export class CitizenGatewayModule {}
