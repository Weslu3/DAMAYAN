import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryItem } from './interfaces/inventory-item.interface.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { AdjustQuantityDto } from './dto/adjust-quantity.dto.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class InventoryService {
  private static readonly LOW_STOCK_THRESHOLD = 500;

  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string): Promise<InventoryItem[]> {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('relief_items')
      .select('id, operation_id, item_name, category, quantity, unit, source, status, created_at')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `item_name.ilike.%${search}%,category.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new NotFoundException(error.message);

    return (data ?? []).map((row: any) => this.toInventoryItem(row));
  }

  async findOne(id: string): Promise<InventoryItem> {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_items')
      .select('id, operation_id, item_name, category, quantity, unit, source, status, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    return this.toInventoryItem(data);
  }

  async create(createItemDto: CreateItemDto): Promise<InventoryItem> {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_items')
      .insert({
        operation_id: createItemDto.operationId,
        item_name: createItemDto.name,
        category: createItemDto.category,
        quantity: createItemDto.quantity,
        unit: createItemDto.unit,
        source: createItemDto.source,
        status: createItemDto.status ?? 'available',
      })
      .select('id, operation_id, item_name, category, quantity, unit, source, status, created_at')
      .single();

    if (error) throw new NotFoundException(error.message);
    return this.toInventoryItem(data, createItemDto.minRequired);
  }

  async update(
    id: string,
    updateItemDto: UpdateItemDto,
  ): Promise<InventoryItem> {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('relief_items')
      .update({
        operation_id: updateItemDto.operationId ?? existing.operationId ?? null,
        item_name: updateItemDto.name ?? existing.name,
        category: updateItemDto.category ?? existing.category,
        quantity: updateItemDto.quantity ?? existing.quantity,
        unit: updateItemDto.unit ?? existing.unit,
        source: updateItemDto.source ?? existing.source ?? null,
        status: updateItemDto.status ?? existing.dbStatus ?? null,
      })
      .eq('id', id)
      .select('id, operation_id, item_name, category, quantity, unit, source, status, created_at')
      .single();

    if (error) throw new NotFoundException(error.message);
    return this.toInventoryItem(
      data,
      updateItemDto.minRequired ?? existing.minRequired,
    );
  }

  async adjustQuantity(
    id: string,
    adjustQuantityDto: AdjustQuantityDto,
  ): Promise<InventoryItem> {
    const item = await this.findOne(id);
    const newQuantity = Math.max(
      0,
      item.quantity + adjustQuantityDto.adjustment,
    );
    return this.update(id, { quantity: newQuantity });
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('relief_items').delete().eq('id', id);
    if (error) throw new NotFoundException(error.message);
  }

  async getStats() {
    const items = await this.findAll();
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = items.filter((item) => item.status === 'low').length;
    const totalCategories = new Set(items.map((item) => item.category)).size;

    return {
      totalItems,
      lowStockItems,
      totalCategories,
      itemCount: items.length,
    };
  }

  private toInventoryItem(
    row: {
      id: string;
      operation_id: string | null;
      item_name: string;
      category: string;
      quantity: number;
      unit: string | null;
      source: string | null;
      status: string | null;
      created_at: string | null;
    },
    minRequired: number = InventoryService.LOW_STOCK_THRESHOLD,
  ): InventoryItem {
    const dbStatus = row.status?.toLowerCase();
    const normalizedStatus =
      dbStatus === 'low' || dbStatus === 'adequate'
        ? dbStatus
        : row.quantity >= minRequired
          ? 'adequate'
          : 'low';

    return {
      id: row.id,
      operationId: row.operation_id ?? undefined,
      name: row.item_name,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit ?? 'units',
      source: row.source ?? undefined,
      dbStatus: row.status ?? 'available',
      minRequired,
      lastUpdated: row.created_at ? new Date(row.created_at) : new Date(),
      status: normalizedStatus,
    };
  }
}
