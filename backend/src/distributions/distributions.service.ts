import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateDistributionDto } from './dto/create-distribution.dto.js';
import { UpdateDistributionDto } from './dto/update-distribution.dto.js';

interface DistributionRow {
  id: string;
  operation_id: string;
  center_id: string;
  distributed_by: string;
  distribution_date: string;
  notes: string | null;
  status: string | null;
  created_at: string | null;
}

interface DistributionItemRow {
  id: string;
  distribution_id: string;
  item_id: string;
  quantity_distributed: number;
  recipient_count: number;
}

@Injectable()
export class DistributionsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string, operationId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('distributions')
      .select('id, operation_id, center_id, distributed_by, distribution_date, notes, status, created_at')
      .order('distribution_date', { ascending: false });

    if (operationId) {
      query = query.eq('operation_id', operationId);
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    const rows = (data ?? []) as DistributionRow[];
    const ids = rows.map((row) => row.id);
    const { data: itemData, error: itemError } = ids.length
      ? await supabase
          .from('distribution_items')
          .select('id, distribution_id, item_id, quantity_distributed, recipient_count')
          .in('distribution_id', ids)
      : { data: [] as DistributionItemRow[], error: null };

    if (itemError) {
      throw new NotFoundException(itemError.message);
    }

    const groupedItems = new Map<string, DistributionItemRow[]>();
    for (const item of (itemData ?? []) as DistributionItemRow[]) {
      const current = groupedItems.get(item.distribution_id) ?? [];
      current.push(item);
      groupedItems.set(item.distribution_id, current);
    }

    const distributions = rows.map((row) =>
      this.toDistribution(row, groupedItems.get(row.id) ?? []),
    );

    if (!search) {
      return distributions;
    }

    const searchText = search.toLowerCase();
    return distributions.filter(
      (distribution) =>
        distribution.status.toLowerCase().includes(searchText) ||
        distribution.notes?.toLowerCase().includes(searchText) ||
        distribution.centerId.toLowerCase().includes(searchText),
    );
  }

  async findOne(id: string) {
    const distributions = await this.findAll();
    const distribution = distributions.find((entry) => entry.id === id);
    if (!distribution) {
      throw new NotFoundException(`Distribution with ID ${id} not found`);
    }
    return distribution;
  }

  async create(createDistributionDto: CreateDistributionDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('distributions')
      .insert({
        operation_id: createDistributionDto.operationId,
        center_id: createDistributionDto.centerId,
        distributed_by: createDistributionDto.distributedBy,
        distribution_date: createDistributionDto.distributionDate,
        notes: createDistributionDto.notes ?? null,
        status: createDistributionDto.status ?? 'scheduled',
      })
      .select('id, operation_id, center_id, distributed_by, distribution_date, notes, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    const distribution = data as DistributionRow;
    if (createDistributionDto.items.length > 0) {
      const { error: itemError } = await supabase.from('distribution_items').insert(
        createDistributionDto.items.map((item) => ({
          distribution_id: distribution.id,
          item_id: item.itemId,
          quantity_distributed: item.quantityDistributed,
          recipient_count: item.recipientCount,
        })),
      );

      if (itemError) {
        throw new NotFoundException(itemError.message);
      }
    }

    return this.findOne(distribution.id);
  }

  async update(id: string, updateDistributionDto: UpdateDistributionDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('distributions')
      .update({
        operation_id: updateDistributionDto.operationId ?? existing.operationId,
        center_id: updateDistributionDto.centerId ?? existing.centerId,
        distributed_by: updateDistributionDto.distributedBy ?? existing.distributedBy,
        distribution_date: updateDistributionDto.distributionDate ?? existing.distributionDate,
        notes: updateDistributionDto.notes ?? existing.notes ?? null,
        status: updateDistributionDto.status ?? existing.status,
      })
      .eq('id', id)
      .select('id, operation_id, center_id, distributed_by, distribution_date, notes, status, created_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    if (updateDistributionDto.items) {
      const { error: deleteError } = await supabase
        .from('distribution_items')
        .delete()
        .eq('distribution_id', id);

      if (deleteError) {
        throw new NotFoundException(deleteError.message);
      }

      if (updateDistributionDto.items.length > 0) {
        const { error: itemError } = await supabase.from('distribution_items').insert(
          updateDistributionDto.items.map((item) => ({
            distribution_id: id,
            item_id: item.itemId,
            quantity_distributed: item.quantityDistributed,
            recipient_count: item.recipientCount,
          })),
        );

        if (itemError) {
          throw new NotFoundException(itemError.message);
        }
      }
    }

    return this.findOne((data as DistributionRow).id);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('distributions').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const distributions = await this.findAll();
    return {
      totalDistributions: distributions.length,
      completedDistributions: distributions.filter((distribution) =>
        ['completed', 'released'].includes(distribution.status.toLowerCase()),
      ).length,
      totalRecipients: distributions.reduce(
        (sum: number, distribution) =>
          sum +
          distribution.items.reduce(
            (itemSum: number, item) => itemSum + item.recipientCount,
            0,
          ),
        0,
      ),
    };
  }

  private toDistribution(row: DistributionRow, items: DistributionItemRow[]) {
    return {
      id: row.id,
      operationId: row.operation_id,
      centerId: row.center_id,
      distributedBy: row.distributed_by,
      distributionDate: row.distribution_date,
      notes: row.notes ?? undefined,
      status: row.status ?? 'scheduled',
      items: items.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        quantityDistributed: item.quantity_distributed,
        recipientCount: item.recipient_count,
      })),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
