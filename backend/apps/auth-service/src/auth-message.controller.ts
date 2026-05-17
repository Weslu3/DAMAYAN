import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '../../../libs/contracts/src/message-patterns.js';
import { AuthService } from '../../../src/auth/auth.service.js';
import { SignupDto } from '../../../src/auth/dto/signup.dto.js';
import { LoginDto } from '../../../src/auth/dto/login.dto.js';
import { UpdateProfileDto } from '../../../src/auth/dto/update-profile.dto.js';
import { ForgotPasswordDto } from '../../../src/auth/dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../../../src/auth/dto/reset-password.dto.js';
import { CreateGovernmentIdUploadDto } from '../../../src/uploads/dto/create-government-id-upload.dto.js';

@Controller()
export class AuthMessageController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.SIGNUP)
  signup(@Payload() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @MessagePattern(AUTH_PATTERNS.GET_PROFILE)
  getProfile(@Payload() payload: { userId: string }) {
    return this.authService.getProfile(payload.userId);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_PROFILE)
  updateProfile(
    @Payload() payload: { userId: string; updateProfileDto: UpdateProfileDto },
  ) {
    return this.authService.updateProfile(payload.userId, payload.updateProfileDto);
  }

  @MessagePattern(AUTH_PATTERNS.CREATE_GOVERNMENT_ID_UPLOAD_URL)
  createGovernmentIdUploadUrl(
    @Payload() createGovernmentIdUploadDto: CreateGovernmentIdUploadDto,
  ) {
    return this.authService.createGovernmentIdUploadUrl(
      createGovernmentIdUploadDto,
    );
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @MessagePattern(AUTH_PATTERNS.FIND_ALL_USERS)
  findAllUsers(@Payload() filters: { role?: string; status?: string; search?: string }) {
    return this.authService.findAllUsers(filters);
  }

  @MessagePattern(AUTH_PATTERNS.FIND_USER_BY_ID)
  findUserById(@Payload() payload: { profileId: string }) {
    return this.authService.findUserById(payload.profileId);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_USER_STATUS)
  updateUserStatus(@Payload() payload: { profileId: string; status: 'active' | 'inactive' }) {
    return this.authService.updateUserStatus(payload.profileId, payload.status);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_USER_ROLE)
  updateUserRole(@Payload() payload: { profileId: string; role: import('../../../libs/contracts/src/roles.js').AppRole }) {
    return this.authService.updateUserRole(payload.profileId, payload.role);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_DUTY_STATUS)
  updateDutyStatus(@Payload() payload: { authUserId: string; isOnDuty: boolean }) {
    return this.authService.updateDutyStatus(payload.authUserId, payload.isOnDuty);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_ZONE)
  updateZone(@Payload() payload: { authUserId: string; zone: { barangay?: string; municipality?: string; province?: string } }) {
    return this.authService.updateZone(payload.authUserId, payload.zone);
  }
}
