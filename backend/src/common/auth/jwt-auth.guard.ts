import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppRole } from '../../../libs/contracts/src/roles.js';

interface RequestWithHeaders {
  headers: {
    authorization?: string;
  };
  user?: {
    sub: string;
    email: string;
    role: AppRole;
    exp?: number;
    iat?: number;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
      
      if (!jwtSecret) {
        throw new UnauthorizedException('Missing JWT secret configuration');
      }

      request.user = (await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      })) as RequestWithHeaders['user'];
      
      this.logger.debug(`Token verified successfully for user: ${request.user?.email} (role: ${request.user?.role})`);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const detailedMessage =
        error instanceof Error ? error.message : 'Token verification failed';

      this.logger.error(`JWT verification failed: ${detailedMessage}`);

      throw new UnauthorizedException(
        `Invalid or expired token (${detailedMessage})`,
      );
    }
  }
}
