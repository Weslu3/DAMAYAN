import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { DispatcherAccountStatusService } from './dispatcher-account-status.service.js';

@Controller('dispatcher')
export class DispatcherOperationsController {
  constructor(
    @Inject(SiteManagerProxyService)
    private readonly siteManagerProxyService: SiteManagerProxyService,
    @Inject(DispatcherAccountStatusService)
    private readonly dispatcherAccountStatusService: DispatcherAccountStatusService,
  ) {}

  @Get('volunteers')
  findVolunteerOrganizations(@Query('search') search?: string) {
    return this.siteManagerProxyService.findOrganizations(search);
  }

  @Get('dispatch-orders')
  findDispatchOrders(
    @Query('search') search?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.siteManagerProxyService.findDispatchOrders(search, operationId);
  }

  @Post('dispatch-orders')
  createDispatchOrder(@Body() createDispatchOrderDto: CreateDispatchOrderDto) {
    return this.siteManagerProxyService.createDispatchOrder(createDispatchOrderDto);
  }

  @Get('site-managers/account-status')
  getSiteManagerAccountStatuses() {
    return this.dispatcherAccountStatusService.getSiteManagerAccountStatuses();
  }
}
