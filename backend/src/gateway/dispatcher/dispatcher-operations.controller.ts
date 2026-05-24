import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateDispatchOrderDto } from '../../dispatch-orders/dto/create-dispatch-order.dto.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { SiteManagerProxyService } from '../site-manager/site-manager.proxy.service.js';
import { DispatcherAccountStatusService } from './dispatcher-account-status.service.js';
import { DispatcherService } from './dispatcher.service.js';

interface RequestWithUser extends Request {
  user: { sub: string; email: string; role: AppRole };
}

@Controller('dispatcher')
export class DispatcherOperationsController {
  constructor(
    @Inject(SiteManagerProxyService)
    private readonly siteManagerProxyService: SiteManagerProxyService,
    @Inject(DispatcherAccountStatusService)
    private readonly dispatcherAccountStatusService: DispatcherAccountStatusService,
    @Inject(DispatcherService)
    private readonly dispatcherService: DispatcherService,
  ) {}

  @Get('volunteers')
  findVolunteerOrganizations(@Query('search') search?: string) {
    return this.dispatcherService.findResources(search);
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

  @Post('dispatch-orders/external-volunteer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.DISPATCHER)
  createExternalVolunteerDispatch(
    @Body() createDispatchOrderDto: CreateDispatchOrderDto,
    @Req() req: RequestWithUser,
  ) {
    return this.siteManagerProxyService.createDispatchOrder({
      ...createDispatchOrderDto,
      dispatcherAuthUserId: req.user.sub,
      externalVolunteerId: createDispatchOrderDto.externalVolunteerId ?? createDispatchOrderDto.assignedTo,
      isExternalVolunteerDispatch: true,
    });
  }

  @Get('site-managers/account-status')
  getSiteManagerAccountStatuses() {
    return this.dispatcherAccountStatusService.getSiteManagerAccountStatuses();
  }
}
