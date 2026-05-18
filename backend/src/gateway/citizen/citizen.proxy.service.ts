import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  DISASTER_EVENT_PATTERNS,
  INCIDENT_REPORT_PATTERNS,
  REGISTRATION_PATTERNS,
} from '../../../libs/contracts/src/message-patterns.js';
import { OPERATIONS_SERVICE } from '../gateway.tokens.js';
import { CreateCitizenDto } from '../../registrations/dto/create-citizen.dto.js';
import { CreateFamilyDto } from '../../registrations/dto/create-family.dto.js';
import { CreateAnimalDto } from '../../registrations/dto/create-animal.dto.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';

@Injectable()
export class CitizenProxyService {
  constructor(
    @Inject(OPERATIONS_SERVICE) private readonly operationsClient: ClientProxy,
  ) {}

  getCitizenProfile(userId: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.FIND_CITIZEN, { id: userId })
        .pipe(timeout(10000)),
    );
  }

  createCitizen(createCitizenDto: CreateCitizenDto) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.CREATE_CITIZEN, createCitizenDto)
        .pipe(timeout(10000)),
    );
  }

  createFamily(createFamilyDto: CreateFamilyDto) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.CREATE_FAMILY, createFamilyDto)
        .pipe(timeout(10000)),
    );
  }

  createAnimal(createAnimalDto: CreateAnimalDto) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.CREATE_ANIMAL, createAnimalDto)
        .pipe(timeout(10000)),
    );
  }

  getFamiliesByHead(headUserId: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.FIND_FAMILIES_BY_HEAD, { headUserId })
        .pipe(timeout(10000)),
    );
  }

  getAnimalsByUser(userId: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.FIND_ANIMALS_BY_USER, { userId })
        .pipe(timeout(10000)),
    );
  }

  deleteFamilyMembersByQr(qrCodeId: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.DELETE_FAMILY_BY_QR, { qrCodeId })
        .pipe(timeout(10000)),
    );
  }

  updateFamily(id: string, updateFamilyDto: any) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.UPDATE_FAMILY, { id, updateFamilyDto })
        .pipe(timeout(10000)),
    );
  }

  deleteFamily(id: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.DELETE_FAMILY, { id })
        .pipe(timeout(10000)),
    );
  }

  deleteAnimalsByUser(userId: string) {
    return firstValueFrom(
      this.operationsClient
        .send(REGISTRATION_PATTERNS.DELETE_ANIMALS_BY_USER, { userId })
        .pipe(timeout(10000)),
    );
  }

  findActiveDisasterEvent() {
    return firstValueFrom(
      this.operationsClient
        .send(DISASTER_EVENT_PATTERNS.FIND_ACTIVE, {})
        .pipe(timeout(10000)),
    );
  }

  createIncidentReport(createIncidentReportDto: CreateIncidentReportDto) {
    return firstValueFrom(
      this.operationsClient
        .send(INCIDENT_REPORT_PATTERNS.CREATE, createIncidentReportDto)
        .pipe(timeout(10000)),
    );
  }
}
