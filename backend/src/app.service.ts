import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      service: 'damayan-api-gateway',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
