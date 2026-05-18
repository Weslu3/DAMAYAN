export interface CheckIn {
  id: string;
  evacueeId: string;
  evacueeNumber: string;
  firstName: string;
  lastName: string;
  zone: string;
  location: string;
  checkInTime: Date;
  qrCode?: string;
  disasterId?: string;
  familyHead?: string;
  familySize?: number;
  specialNeeds?: string;
  status: 'checked-in' | 'checked-out';
}
