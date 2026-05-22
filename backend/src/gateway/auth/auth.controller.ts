import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthProxyService } from './auth.proxy.service.js';
import { SignupDto } from '../../auth/dto/signup.dto.js';
import { LoginDto } from '../../auth/dto/login.dto.js';
import { ForgotPasswordDto } from '../../auth/dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../../auth/dto/reset-password.dto.js';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto.js';
import { CreateGovernmentIdUploadDto } from '../../uploads/dto/create-government-id-upload.dto.js';
import { UploadsService } from '../../uploads/uploads.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { AppRole } from '../../../libs/contracts/src/roles.js';

interface RequestWithUser {
  user: {
    sub: string;
    email: string;
    role: AppRole;
  };
}

@Controller('auth')
export class AuthGatewayController {
  private readonly logger = new Logger(AuthGatewayController.name);

  constructor(
    @Inject(AuthProxyService) private readonly authProxyService: AuthProxyService,
    @Inject(UploadsService) private readonly uploadsService: UploadsService,
  ) {}

  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    return this.authProxyService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`Gateway login request: email=${loginDto.email}, requiredRole=${loginDto.requiredRole}`);
    return this.authProxyService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: RequestWithUser) {
    return this.authProxyService.getProfile(request.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Req() request: RequestWithUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authProxyService.updateProfile(request.user.sub, updateProfileDto);
  }

  @Post('uploads/government-id')
  createGovernmentIdUploadUrl(
    @Body() createGovernmentIdUploadDto: CreateGovernmentIdUploadDto,
  ) {
    return this.authProxyService.createGovernmentIdUploadUrl(
      createGovernmentIdUploadDto,
    );
  }

  @Post('uploads/profile-photo')
  @UseGuards(JwtAuthGuard)
  createProfilePhotoUploadUrl(
    @Req() request: RequestWithUser,
    @Body() body: { fileName: string },
  ) {
    return this.uploadsService.createProfilePhotoUploadUrl(request.user.sub, body.fileName);
  }

  @Post('uploads/incident-photo')
  @UseGuards(JwtAuthGuard)
  createIncidentPhotoUploadUrl(
    @Req() request: RequestWithUser,
    @Body() body: { fileName: string },
  ) {
    return this.uploadsService.createCitizenIncidentPhotoUploadUrl(request.user.sub, body.fileName);
  }

  @Post('uploads/view-url')
  @UseGuards(JwtAuthGuard)
  getFileViewUrl(@Body() body: { bucket: string; objectPath: string; expiresIn?: number }) {
    return this.uploadsService.createObjectViewUrl({
      bucket: body.bucket,
      objectPath: body.objectPath,
      expiresIn: body.expiresIn ?? 3600,
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authProxyService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authProxyService.resetPassword(resetPasswordDto);
  }
}
