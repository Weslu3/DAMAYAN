import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  GatewayTimeoutException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import {
  ForgotPasswordDto,
  RecoveryMethod,
} from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AppRole } from '../../libs/contracts/src/roles.js';
import { CreateGovernmentIdUploadDto } from '../uploads/dto/create-government-id-upload.dto.js';
import { createClient } from '@supabase/supabase-js';

interface UserProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  auth_user_id?: string | null;
}

interface PasswordResetRequestRow {
  id: string;
  auth_user_id: string;
  email: string;
  token_hash: string;
  status: 'pending' | 'used' | 'expired';
  expires_at: string;
  used_at: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto) {
    const requestedRole = signupDto.role || AppRole.CITIZEN;
    const allowManagementSelfSignup = this.getAllowManagementSelfSignup();
    
    // Check if roles are allowed for self-signup
    if (requestedRole !== AppRole.DISPATCHER && requestedRole !== AppRole.CITIZEN) {
      if (!allowManagementSelfSignup) {
        throw new BadRequestException(
          'Only dispatcher and citizen roles can self-signup. Set ALLOW_ADMIN_SELF_SIGNUP=true to allow line_manager/admin self-signup.',
        );
      }
    }

    const supabase = this.supabaseService.getClient() as any;
    const formattedPhone = this.formatPhoneForStorage(signupDto.phone);

    // Create the auth user using Supabase Admin API (bypassing RLS trigger issue since execution is by service_role)
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: signupDto.email,
      password: signupDto.password,
      email_confirm: true, // Automatically confirm email to avoid verification friction
      user_metadata: {
        first_name: signupDto.firstName,
        last_name: signupDto.lastName,
        role: requestedRole,
        government_id_file_name: signupDto.governmentIdFileName ?? null,
      },
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new BadRequestException(signUpError.message);
    }

    const authUser = signUpData.user;
    if (!authUser) {
      throw new BadRequestException('Unable to create auth user');
    }

    // Execute database upsert with service_role client (bypassing RLS and supporting auto-triggers cleanly)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        auth_user_id: authUser.id,
        first_name: signupDto.firstName,
        last_name: signupDto.lastName,
        phone: formattedPhone,
        address: signupDto.address ?? null,
        barangay: signupDto.barangay ?? null,
        municipality: signupDto.municipality ?? null,
        province: signupDto.province ?? null,
        profile_photo_key: signupDto.governmentIdKey ?? null,
        role: requestedRole,
      }, {
        onConflict: 'auth_user_id'
      });

    if (profileError) {
      throw new BadRequestException(
        `Profile creation failed: ${profileError.message}`,
      );
    }

    const payload = {
      sub: authUser.id,
      email: signupDto.email,
      role: requestedRole,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Signup successful',
      access_token: accessToken,
      user: {
        id: authUser.id,
        firstName: signupDto.firstName,
        lastName: signupDto.lastName,
        name: `${signupDto.firstName} ${signupDto.lastName}`.trim(),
        email: signupDto.email,
        phone: formattedPhone,
        role: requestedRole,
        accountStatus: 'pending',
      },
    };
  }

  async createGovernmentIdUploadUrl(createGovernmentIdUploadDto: CreateGovernmentIdUploadDto) {
    const supabase = this.supabaseService.getClient();
    const bucket =
      this.configService.get<string>('SUPABASE_GOVERNMENT_IDS_BUCKET') ??
      'government-ids';

    const objectPath = this.buildGovernmentIdObjectPath(createGovernmentIdUploadDto);
    let { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    const uploadErrorMessage = error?.message?.toLowerCase() ?? '';
    const shouldCreateBucket =
      uploadErrorMessage.includes('bucket not found') ||
      uploadErrorMessage.includes('related resource does not exist') ||
      uploadErrorMessage.includes('resource does not exist');

    if (shouldCreateBucket) {
      await this.ensureGovernmentIdBucket(bucket);
      const retryResult = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath);
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Unable to create signed Government ID upload URL',
      );
    }

    return {
      bucket,
      objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
  }

  async login(loginDto: LoginDto) {
    this.logger.log(`AuthService.login Payload: ${JSON.stringify(loginDto)}`);
    const supabase = this.supabaseService.getClient() as any;
    
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new BadRequestException('Supabase connection parameters are missing in environment.');
    }

    // Ephemeral client for isolated login to keep admin client untouched
    const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await this.withTimeout<any>(
      ephemeralClient.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password,
      }),
      'Authentication service timed out during login.',
    );

    if (error) {
      this.logger.warn(
        `Supabase signInWithPassword failed for ${loginDto.email}: ${error.message}`,
      );

      if (error.message?.toLowerCase().includes('email not confirmed')) {
        throw new UnauthorizedException(
          'Email not confirmed. Please verify your inbox before signing in.',
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (!data.user) {
      this.logger.warn(`Supabase sign-in returned no user for ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = data.user.id;
    const { data: profile, error: profileError } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .select('id, first_name, last_name, phone, role, status')
        .eq('auth_user_id', userId)
        .maybeSingle(),
      'Profile lookup timed out during login.',
    );

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    // If a profile exists, use its role; otherwise, default to citizen for general access
    const userRole = (profile?.role as string) || 'citizen';
    const requiredRole = loginDto.requiredRole as string | undefined;

    this.logger.debug(
      `Verifying access: userRole='${userRole}', requiredRole='${requiredRole}'`,
    );

    // CRITICAL: If a specific role is required, and we either:
    // 1. Found no profile (userRole defaulted to citizen)
    // 2. The role doesn't match
    // ...then we must block access.
    if (requiredRole && (!profile || userRole !== requiredRole)) {
      const displayRole = requiredRole.replace('line_manager', 'site manager').replace('_', ' ');
      throw new UnauthorizedException(
        `This account does not have ${displayRole} access.`,
      );
    }

    const payload = {
      sub: userId,
      email: loginDto.email,
      role: userRole,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: loginDto.rememberMe ? '30d' : '7d',
    });

    return {
      message: 'Login successful',
      access_token: accessToken,
      expiresIn: loginDto.rememberMe ? '30d' : '7d',
      user: {
        id: profile?.id ?? userId,
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        email: loginDto.email,
        phone: profile?.phone ?? '',
        role: (profile?.role as AppRole | undefined) ?? AppRole.CITIZEN,
        accountStatus: (profile?.status as string | undefined) ?? 'active',
      },
    };
  }

  async getProfile(userId: string) {
    const supabase = this.supabaseService.getClient() as any;

    const [{ data: profile, error: profileError }, { data: authUser, error: authUserError }] =
      await Promise.all([
        this.withTimeout<any>(
          supabase
            .from('user_profiles')
            .select('id, first_name, last_name, phone, role, status, auth_user_id')
            .eq('auth_user_id', userId)
            .maybeSingle(),
          'Profile lookup timed out while loading the current user.',
        ),
        this.withTimeout<any>(
          supabase.auth.admin.getUserById(userId),
          'Auth lookup timed out while loading the current user.',
        ),
      ]);

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    if (authUserError) {
      throw new BadRequestException(authUserError.message);
    }

    const resolvedProfile = profile as UserProfileRow | null;
    const email = authUser?.user?.email ?? '';

    return {
      user: {
        id: resolvedProfile?.id ?? userId,
        authUserId: userId,
        firstName: resolvedProfile?.first_name ?? '',
        lastName: resolvedProfile?.last_name ?? '',
        name: `${resolvedProfile?.first_name ?? ''} ${resolvedProfile?.last_name ?? ''}`.trim(),
        email,
        phone: resolvedProfile?.phone ?? '',
        role: (resolvedProfile?.role as AppRole | undefined) ?? AppRole.CITIZEN,
        accountStatus: (resolvedProfile?.status as string | undefined) ?? 'active',
      },
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const supabase = this.supabaseService.getClient() as any;

    const profileUpdates: Record<string, string> = {};
    if (updateProfileDto.firstName) {
      profileUpdates.first_name = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName) {
      profileUpdates.last_name = updateProfileDto.lastName;
    }
    if (updateProfileDto.phone) {
      profileUpdates.phone = this.formatPhoneForStorage(updateProfileDto.phone);
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await this.withTimeout<any>(
        supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('auth_user_id', userId),
        'Profile update timed out.',
      );

      if (profileError) {
        throw new BadRequestException(profileError.message);
      }
    }

    if (updateProfileDto.email) {
      const normalizedEmail = updateProfileDto.email.trim().toLowerCase();
      const { error: authUpdateError } = await this.withTimeout<any>(
        supabase.auth.admin.updateUserById(userId, {
          email: normalizedEmail,
        }),
        'Auth email update timed out.',
      );

      if (authUpdateError) {
        throw new BadRequestException(authUpdateError.message);
      }
    }

    if (updateProfileDto.password) {
      const { error: authUpdateError } = await this.withTimeout<any>(
        supabase.auth.admin.updateUserById(userId, {
          password: updateProfileDto.password,
        }),
        'Auth password update timed out.',
      );

      if (authUpdateError) {
        throw new BadRequestException(authUpdateError.message);
      }
    }

    return this.getProfile(userId);
  }

  private async withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 15000): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new GatewayTimeoutException(message));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const supabase = this.supabaseService.getClient() as any;
    const method: RecoveryMethod =
      forgotPasswordDto.method ??
      (forgotPasswordDto.contact?.includes('@')
        ? RecoveryMethod.EMAIL
        : RecoveryMethod.SMS);
    const email =
      forgotPasswordDto.email ??
      (method === RecoveryMethod.EMAIL ? forgotPasswordDto.contact : undefined);
    const phone =
      forgotPasswordDto.phone ??
      (method === RecoveryMethod.SMS ? forgotPasswordDto.contact : undefined);
    const contact =
      method === RecoveryMethod.EMAIL ? email ?? '' : phone ?? '';

    if (!contact) {
      throw new BadRequestException('A valid contact value is required');
    }

    const normalizedContact = this.normalizeContact(contact, method);
    const resetIdentity = await this.findUserForPasswordReset(
      normalizedContact,
      method,
    );
    const code = randomInt(1000, 10000).toString();
    const tokenHash = this.hashResetCode(code);

    await supabase
      .from('password_reset_requests')
      .update({
        status: 'expired',
      })
      .eq('email', resetIdentity.email)
      .eq('status', 'pending');

    const { error: resetRequestError } = await supabase
      .from('password_reset_requests')
      .insert({
        auth_user_id: resetIdentity.userId,
        email: resetIdentity.email,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        used_at: null,
      });

    if (resetRequestError) {
      throw new BadRequestException(
        `Password reset request could not be stored: ${resetRequestError.message}`,
      );
    }

    await this.notificationsService.sendPasswordResetCode(
      method,
      normalizedContact,
      code,
    );

    return {
      message: 'Verification code sent',
      maskedContact: this.maskContact(normalizedContact, method),
      ...(process.env.NODE_ENV !== 'production'
        ? { debugVerificationCode: code }
        : {}),
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const code = resetPasswordDto.code ?? resetPasswordDto.verificationCode;
    const { newPassword, contact } = resetPasswordDto;
    if (!code) {
      throw new BadRequestException('Verification code is required');
    }

    const method = contact.includes('@')
      ? RecoveryMethod.EMAIL
      : RecoveryMethod.SMS;
    const normalizedContact = this.normalizeContact(contact, method);
    const resetIdentity = await this.findUserForPasswordReset(
      normalizedContact,
      method,
    );
    const supabase = this.supabaseService.getClient() as any;
    const { data: resetRequest, error: resetRequestError } = await supabase
      .from('password_reset_requests')
      .select('id, auth_user_id, email, token_hash, status, expires_at, used_at')
      .eq('email', resetIdentity.email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (resetRequestError) {
      throw new BadRequestException(resetRequestError.message);
    }

    if (!resetRequest) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const resetRequestRow = resetRequest as PasswordResetRequestRow;

    if (resetRequestRow.status === 'used' || resetRequestRow.used_at) {
      throw new UnauthorizedException('Verification code has already been used');
    }

    if (resetRequestRow.status === 'expired') {
      throw new UnauthorizedException('Verification code expired');
    }

    const incomingHash = this.hashResetCode(code);
    if (!this.safeHashEquals(resetRequestRow.token_hash, incomingHash)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (new Date(resetRequestRow.expires_at).getTime() < Date.now()) {
      await supabase
        .from('password_reset_requests')
        .update({ status: 'expired' })
        .eq('id', resetRequestRow.id);
      throw new UnauthorizedException('Verification code expired');
    }

    const { error } = await supabase.auth.admin.updateUserById(
      resetRequestRow.auth_user_id,
      { password: newPassword },
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    await supabase
      .from('password_reset_requests')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
      })
      .eq('id', resetRequestRow.id);

    return {
      message: 'Password reset successful.',
    };
  }

  private maskContact(contact: string, method: RecoveryMethod): string {
    if (method === RecoveryMethod.EMAIL) {
      const [username, domain] = contact.split('@');
      const masked =
        username.substring(0, 2) +
        '***' +
        username.substring(username.length - 1);
      return `${masked}@${domain}`;
    } else {
      // Phone: +63XXXXXXXXXX -> +63XXX***XX
      return (
        contact.substring(0, 6) + '***' + contact.substring(contact.length - 2)
      );
    }
  }

  private normalizeContact(contact: string, method: RecoveryMethod): string {
    if (method === RecoveryMethod.EMAIL) {
      return contact.trim().toLowerCase();
    }

    let digits = contact.replace(/\D/g, '');

    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    return `+63${digits.slice(0, 10)}`;
  }

  private formatPhoneForStorage(phone: string): string {
    let digits = phone.replace(/\D/g, '');

    if (digits.startsWith('63')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    const localDigits = digits.slice(0, 10);
    return `+63-${localDigits.slice(0, 3)}-${localDigits.slice(3, 6)}-${localDigits.slice(6, 10)}`;
  }

  private async findUserForPasswordReset(
    contact: string,
    method: RecoveryMethod,
  ): Promise<{ userId: string; email: string }> {
    const supabase = this.supabaseService.getClient() as any;

    if (method === RecoveryMethod.EMAIL) {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) {
        throw new BadRequestException(error.message);
      }

      const matchedUser = data.users.find(
        (user: { id: string; email?: string | null }) =>
          user.email?.toLowerCase() === contact,
      );

      if (!matchedUser) {
        throw new BadRequestException('No account found for that email');
      }

      return {
        userId: matchedUser.id,
        email: contact,
      };
    }

    const formattedPhone = this.formatPhoneForStorage(contact);
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('auth_user_id, phone')
      .not('auth_user_id', 'is', null);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const matchedProfile = (profiles as UserProfileRow[]).find((profile) => {
      const profilePhone = profile.phone ?? '';
      return (
        this.normalizeContact(profilePhone, RecoveryMethod.SMS) === contact ||
        profilePhone === formattedPhone
      );
    });

    if (!matchedProfile?.auth_user_id) {
      throw new BadRequestException('No account found for that phone number');
    }

    const { data: authLookup, error: authLookupError } =
      await supabase.auth.admin.getUserById(matchedProfile.auth_user_id);

    if (authLookupError) {
      throw new BadRequestException(authLookupError.message);
    }

    const resolvedEmail = authLookup?.user?.email?.trim().toLowerCase();
    if (!resolvedEmail) {
      throw new BadRequestException('Matched account does not have a valid email');
    }

    return {
      userId: matchedProfile.auth_user_id,
      email: resolvedEmail,
    };
  }

  private hashResetCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private safeHashEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private getAllowManagementSelfSignup(): boolean {
    const configuredValue = this.configService?.get<string | boolean>('ALLOW_ADMIN_SELF_SIGNUP');

    if (typeof configuredValue === 'boolean') {
      return configuredValue;
    }

    if (typeof configuredValue === 'string') {
      return configuredValue.toLowerCase() === 'true';
    }

    return String(process.env.ALLOW_ADMIN_SELF_SIGNUP ?? 'false').toLowerCase() === 'true';
  }

  private buildGovernmentIdObjectPath(
    createGovernmentIdUploadDto: CreateGovernmentIdUploadDto,
  ): string {
    const applicantRole = createGovernmentIdUploadDto.applicantRole
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    const applicantEmail = createGovernmentIdUploadDto.applicantEmail
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]+/g, '-');
    const sanitizedFileName = createGovernmentIdUploadDto.fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-');

    if (!sanitizedFileName) {
      throw new BadRequestException('A valid Government ID file name is required');
    }

    const prefix = `${applicantRole || 'applicant'}/${applicantEmail || 'unknown'}`;
    return `${prefix}/${Date.now()}-${sanitizedFileName}`;
  }

  private async ensureGovernmentIdBucket(bucket: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    });

    if (error && !error.message?.toLowerCase().includes('already exists')) {
      throw new BadRequestException(
        `Unable to initialize Government ID bucket: ${error.message}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin: User Management
  // ──────────────────────────────────────────────────────────────────────────

  async findAllUsers(filters?: { role?: string; status?: string; search?: string }) {
    const supabase = this.supabaseService.getClient() as any;

    let query = supabase
      .from('user_profiles')
      .select('id, auth_user_id, first_name, last_name, phone, role, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`,
      );
    }

    const { data: profiles, error } = await this.withTimeout<any>(
      query,
      'User list query timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data: authListData, error: authListError } = await this.withTimeout<any>(
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      'Auth user list timed out.',
    );

    if (authListError) {
      throw new BadRequestException(authListError.message);
    }

    const emailMap = new Map<string, string>(
      (authListData?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? '']),
    );

    return {
      users: (profiles as UserProfileRow[]).map((p) => ({
        id: p.id,
        authUserId: p.auth_user_id ?? '',
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        email: emailMap.get(p.auth_user_id ?? '') ?? '',
        phone: p.phone ?? '',
        role: p.role as AppRole,
        accountStatus: p.status ?? 'active',
      })),
    };
  }

  async findUserById(profileId: string) {
    const supabase = this.supabaseService.getClient() as any;

    const { data: profile, error } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .select('id, auth_user_id, first_name, last_name, phone, role, status, created_at, updated_at')
        .eq('id', profileId)
        .maybeSingle(),
      'User lookup timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!profile) {
      throw new BadRequestException('User not found');
    }

    const p = profile as UserProfileRow;
    const { data: authData, error: authError } = await this.withTimeout<any>(
      supabase.auth.admin.getUserById(p.auth_user_id ?? ''),
      'Auth user lookup timed out.',
    );

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    return {
      user: {
        id: p.id,
        authUserId: p.auth_user_id ?? '',
        firstName: p.first_name ?? '',
        lastName: p.last_name ?? '',
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        email: authData?.user?.email ?? '',
        phone: p.phone ?? '',
        role: p.role as AppRole,
        accountStatus: p.status ?? 'active',
      },
    };
  }

  async updateUserStatus(profileId: string, newStatus: 'active' | 'inactive') {
    const supabase = this.supabaseService.getClient() as any;

    const { error } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', profileId),
      'User status update timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: `User status updated to '${newStatus}'.` };
  }

  async updateUserRole(profileId: string, role: AppRole) {
    const supabase = this.supabaseService.getClient() as any;

    const { error } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', profileId),
      'User role update timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: `User role updated to '${role}'.` };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Site Manager: On-duty / Zone
  // ──────────────────────────────────────────────────────────────────────────

  async updateDutyStatus(authUserId: string, isOnDuty: boolean) {
    const supabase = this.supabaseService.getClient() as any;

    const { error } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .update({ is_on_duty: isOnDuty, updated_at: new Date().toISOString() })
        .eq('auth_user_id', authUserId),
      'Duty status update timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: `On-duty status set to ${isOnDuty}.`, isOnDuty };
  }

  async updateZone(authUserId: string, zone: { barangay?: string; municipality?: string; province?: string }) {
    const supabase = this.supabaseService.getClient() as any;

    const updates: Record<string, string | undefined> = {};
    if (zone.barangay !== undefined) updates.barangay = zone.barangay;
    if (zone.municipality !== undefined) updates.municipality = zone.municipality;
    if (zone.province !== undefined) updates.province = zone.province;
    updates.updated_at = new Date().toISOString();

    const { error } = await this.withTimeout<any>(
      supabase
        .from('user_profiles')
        .update(updates)
        .eq('auth_user_id', authUserId),
      'Zone update timed out.',
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Zone updated successfully.', zone };
  }
}
