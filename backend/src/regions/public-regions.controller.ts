import { Controller, Get, Inject } from '@nestjs/common';
import { RegionsService } from './regions.service.js';

@Controller('regions')
export class PublicRegionsController {
  constructor(@Inject(RegionsService) private readonly regionsService: RegionsService) {}

  @Get()
  findAll() {
    return this.regionsService.findAll();
  }
}
