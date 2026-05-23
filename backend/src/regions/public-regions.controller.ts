import { Controller, Get, Inject } from '@nestjs/common';
import { RegionsService } from './regions.service.js';

@Controller('public')
export class PublicRegionsController {
  constructor(@Inject(RegionsService) private readonly regionsService: RegionsService) {}

  @Get('regions')
  findAllRegions() {
    return this.regionsService.findAll();
  }
}