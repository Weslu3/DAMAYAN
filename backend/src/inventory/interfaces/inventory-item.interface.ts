export interface InventoryItem {
  id: string;
  operationId?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  source?: string;
  dbStatus?: string;
  minRequired: number;
  lastUpdated: Date;
  status: 'low' | 'adequate';
}
