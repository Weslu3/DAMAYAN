import { IsNotEmpty, IsString } from 'class-validator';

export class ScanQrDto {
  @IsNotEmpty()
  @IsString()
  qrCode: string; // QR code data
}
