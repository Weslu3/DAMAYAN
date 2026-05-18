import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Inject } from '@nestjs/common';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { CreateIncidentReportDto } from '../../incident-reports/dto/create-incident-report.dto.js';
import { UpdateIncidentReportDto } from '../../incident-reports/dto/update-incident-report.dto.js';

@Controller('dispatcher/incident-reports')
export class DispatcherIncidentReportsController {
  constructor(@Inject(SiteManagerProxyService) private readonly siteManagerProxyService: SiteManagerProxyService) {}

  @Get()
  findIncidentReports(
    @Query('search') search?: string,
    @Query('disasterId') disasterId?: string,
  ) {
    return this.siteManagerProxyService.findIncidentReports(search, disasterId);
  }

  @Post()
  createIncidentReport(@Body() createIncidentReportDto: CreateIncidentReportDto) {
    return this.siteManagerProxyService.createIncidentReport(createIncidentReportDto);
  }

  @Patch(':id')
  updateIncidentReport(
    @Param('id') id: string,
    @Body() updateIncidentReportDto: UpdateIncidentReportDto,
  ) {
    return this.siteManagerProxyService.updateIncidentReport(id, updateIncidentReportDto);
  }

  @Delete(':id')
  deleteIncidentReport(@Param('id') id: string) {
    return this.siteManagerProxyService.deleteIncidentReport(id);
  }
}
