export class TribeClient {
  constructor(config) {
    this.config = config;
  }
  async authenticate() {
    return Promise.resolve();
  }
  async listTribeServices() {
    return [];
  }
  async listSharedServices() {
    return [];
  }
  async emailSend(payload) {
    return { success: true };
  }
  async smsSend(payload) {
    return { success: true };
  }
  async geoGeocodeAddress(payload) {
    return { results: [] };
  }
}
