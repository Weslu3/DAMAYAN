import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AUTH_PATTERNS } from '../../../libs/contracts/src/message-patterns.js';
import { SignupDto } from '../../auth/dto/signup.dto.js';
import { LoginDto } from '../../auth/dto/login.dto.js';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto.js';
import { ForgotPasswordDto } from '../../auth/dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../../auth/dto/reset-password.dto.js';
import { CreateGovernmentIdUploadDto } from '../../uploads/dto/create-government-id-upload.dto.js';

@Injectable()
export class AuthProxyService {
  private readonly logger = new Logger(AuthProxyService.name);

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {
    this.logger.log('AuthProxyService created');
  }

  signup(signupDto: SignupDto) {
    return firstValueFrom(
      this.authClient.send(AUTH_PATTERNS.SIGNUP, signupDto).pipe(timeout(20000)),
    );
  }

  login(loginDto: LoginDto) {
    return firstValueFrom(
      this.authClient.send(AUTH_PATTERNS.LOGIN, loginDto).pipe(timeout(20000)),
    );
  }

  getProfile(userId: string) {
    return firstValueFrom(
      this.authClient.send(AUTH_PATTERNS.GET_PROFILE, { userId }).pipe(timeout(20000)),
    );
  }

  updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    return firstValueFrom(
      this.authClient
        .send(AUTH_PATTERNS.UPDATE_PROFILE, { userId, updateProfileDto })
        .pipe(timeout(20000)),
    );
  }

  createGovernmentIdUploadUrl(
    createGovernmentIdUploadDto: CreateGovernmentIdUploadDto,
  ) {
    return firstValueFrom(
      this.authClient
        .send(
          AUTH_PATTERNS.CREATE_GOVERNMENT_ID_UPLOAD_URL,
          createGovernmentIdUploadDto,
        )
        .pipe(timeout(20000)),
    );
  }

  forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    return firstValueFrom(
      this.authClient
        .send(AUTH_PATTERNS.FORGOT_PASSWORD, forgotPasswordDto)
        .pipe(timeout(20000)),
    );
  }

  resetPassword(resetPasswordDto: ResetPasswordDto) {
    return firstValueFrom(
      this.authClient
        .send(AUTH_PATTERNS.RESET_PASSWORD, resetPasswordDto)
        .pipe(timeout(20000)),
    );
  }
}
