import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TribeClient } from '@implementsprint/sdk';

@Injectable()
export class ApiCenterService {
  constructor(private readonly configService: ConfigService) {}

  async getStatus() {
    await this.authenticateClient();

    return {
      connected: true,
      gatewayUrl: this.getRequiredEnv('APICENTER_URL'),
      tribeId: this.getRequiredEnv('APICENTER_TRIBE_ID'),
    };
  }

  async listAccessibleServices() {
    const client = await this.authenticateClient();

    try {
      const [tribeServices, sharedServices] = await Promise.all([
        client.listTribeServices(),
        client.listSharedServices(),
      ]);

      return {
        tribeServices,
        sharedServices,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown APICenter error';
      throw new ServiceUnavailableException(`Unable to list APICenter services: ${message}`);
    }
  }

  private async authenticateClient() {
    const client = this.createClient();

    try {
      await client.authenticate();
      return client;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown APICenter error';
      throw new ServiceUnavailableException(`Unable to authenticate with APICenter: ${message}`);
    }
  }

  private createClient() {
    const gatewayUrl = this.getRequiredEnv('APICENTER_URL');
    const tribeId = this.getRequiredEnv('APICENTER_TRIBE_ID');
    const secret = this.getRequiredEnv('APICENTER_TRIBE_SECRET');

    return new TribeClient({
      gatewayUrl,
      tribeId,
      secret,
    });
  }

  private getRequiredEnv(key: 'APICENTER_URL' | 'APICENTER_TRIBE_ID' | 'APICENTER_TRIBE_SECRET') {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException(`Missing ${key} environment variable`);
    }

    return value;
  }
}
