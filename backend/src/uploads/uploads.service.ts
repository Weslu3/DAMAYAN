import { BadRequestException, Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateDisasterCoverUploadDto } from './dto/create-disaster-cover-upload.dto.js';
import { CreateIncidentAttachmentUploadDto } from './dto/create-incident-attachment-upload.dto.js';
import { CreateObjectViewUrlDto } from './dto/create-object-view-url.dto.js';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async createDisasterCoverUploadUrl(
    createUploadDto: CreateDisasterCoverUploadDto,
  ) {
    const bucket =
      this.configService.get<string>('SUPABASE_DISASTER_COVERS_BUCKET') ??
      'disaster-covers';
    const objectPath = this.buildObjectPath(
      createUploadDto.disasterEventId,
      createUploadDto.fileName,
    );

    return this.createSignedUploadUrl(bucket, objectPath);
  }

  async createIncidentAttachmentUploadUrl(
    createUploadDto: CreateIncidentAttachmentUploadDto,
  ) {
    const bucket =
      this.configService.get<string>('SUPABASE_INCIDENT_ATTACHMENTS_BUCKET') ??
      'incident-attachments';
    const objectPath = this.buildObjectPath(
      createUploadDto.incidentReportId,
      createUploadDto.fileName,
    );

    return this.createSignedUploadUrl(bucket, objectPath);
  }

  async createObjectViewUrl(createObjectViewUrlDto: CreateObjectViewUrlDto) {
    const supabase = this.supabaseService.getClient();
    const expiresIn = createObjectViewUrlDto.expiresIn ?? 3600;
    const { data, error } = await supabase.storage
      .from(createObjectViewUrlDto.bucket)
      .createSignedUrl(createObjectViewUrlDto.objectPath, expiresIn);

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Unable to create signed object URL',
      );
    }

    return {
      bucket: createObjectViewUrlDto.bucket,
      objectPath: createObjectViewUrlDto.objectPath,
      signedUrl: data.signedUrl,
      expiresIn,
    };
  }

  private async createSignedUploadUrl(bucket: string, objectPath: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Unable to create signed upload URL',
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

  private buildObjectPath(entityId: string, fileName: string): string {
    const sanitizedFileName = fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-');

    if (!sanitizedFileName) {
      throw new BadRequestException('A valid file name is required');
    }

    return `${entityId}/${Date.now()}-${sanitizedFileName}`;
  }
}
