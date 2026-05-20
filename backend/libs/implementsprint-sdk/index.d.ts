export interface EmailSendRequest {
  to: string;
  subject: string;
  body: string;
}
export interface SmsSendRequest {
  to: string;
  body: string;
}
export interface GeoGeocodeAddressRequest {
  address: string;
  region?: string;
}
export class TribeClient {
  constructor(config: { gatewayUrl: string; tribeId: string; secret: string });
  authenticate(): Promise<void>;
  listTribeServices(): Promise<any>;
  listSharedServices(): Promise<any>;
  emailSend(payload: EmailSendRequest): Promise<any>;
  smsSend(payload: SmsSendRequest): Promise<any>;
  geoGeocodeAddress(payload: GeoGeocodeAddressRequest): Promise<any>;
}
