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
