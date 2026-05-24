import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppRole } from '../../../libs/contracts/src/roles.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

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
    @Optional()
    @Inject(SupabaseService)
    private readonly supabaseService?: SupabaseService,
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

      // Keep access control aligned with latest Supabase role changes even when
      // the client still holds an older JWT.
      if (this.supabaseService && request.user?.sub) {
        try {
          const supabase = this.supabaseService.getClient() as any;
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('auth_user_id', request.user.sub)
            .maybeSingle();

          const dbRole = profile?.role as AppRole | undefined;
          if (dbRole && dbRole !== request.user.role) {
            this.logger.debug(
              `Role refreshed from Supabase for ${request.user.email}: ${request.user.role} -> ${dbRole}`,
            );
            request.user.role = dbRole;
          }
        } catch (syncError) {
          this.logger.warn(
            `Role sync skipped: ${syncError instanceof Error ? syncError.message : 'unknown error'}`,
          );
        }
      }
      
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
