import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto.js';
import { UpdateDispatchOrderDto } from './dto/update-dispatch-order.dto.js';

interface DispatchOrderRow {
  id: string;
  report_id: string;
  operation_id: string;
  assigned_to: string;
  priority: string;
  instructions: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable()
export class DispatchOrdersService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async findAll(search?: string, operationId?: string) {
    const supabase = this.supabaseService.getClient() as any;
    let query = supabase
      .from('dispatch_orders')
      .select('id, report_id, operation_id, assigned_to, priority, instructions, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (operationId) {
      query = query.eq('operation_id', operationId);
    }

    const { data, error } = await query;
    if (error) {
      throw new NotFoundException(error.message);
    }

    const orders = ((data ?? []) as DispatchOrderRow[]).map((row) => this.toDispatchOrder(row));
    if (!search) {
      return orders;
    }

    const queryText = search.toLowerCase();
    return orders.filter(
      (order) =>
        order.priority.toLowerCase().includes(queryText) ||
        order.status.toLowerCase().includes(queryText) ||
        order.assignedTo.toLowerCase().includes(queryText) ||
        order.instructions?.toLowerCase().includes(queryText),
    );
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('dispatch_orders')
      .select('id, report_id, operation_id, assigned_to, priority, instructions, status, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Dispatch order with ID ${id} not found`);
    }

    return this.toDispatchOrder(data as DispatchOrderRow);
  }

  async create(createDispatchOrderDto: CreateDispatchOrderDto) {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('dispatch_orders')
      .insert({
        report_id: createDispatchOrderDto.reportId,
        operation_id: createDispatchOrderDto.operationId,
        assigned_to: createDispatchOrderDto.assignedTo,
        priority: createDispatchOrderDto.priority ?? 'normal',
        instructions: createDispatchOrderDto.instructions ?? null,
        status: createDispatchOrderDto.status ?? 'pending',
      })
      .select('id, report_id, operation_id, assigned_to, priority, instructions, status, created_at, updated_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toDispatchOrder(data as DispatchOrderRow);
  }

  async update(id: string, updateDispatchOrderDto: UpdateDispatchOrderDto) {
    const existing = await this.findOne(id);
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('dispatch_orders')
      .update({
        report_id: updateDispatchOrderDto.reportId ?? existing.reportId,
        operation_id: updateDispatchOrderDto.operationId ?? existing.operationId,
        assigned_to: updateDispatchOrderDto.assignedTo ?? existing.assignedTo,
        priority: updateDispatchOrderDto.priority ?? existing.priority,
        instructions: updateDispatchOrderDto.instructions ?? existing.instructions ?? null,
        status: updateDispatchOrderDto.status ?? existing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, report_id, operation_id, assigned_to, priority, instructions, status, created_at, updated_at')
      .single();

    if (error) {
      throw new NotFoundException(error.message);
    }

    return this.toDispatchOrder(data as DispatchOrderRow);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient() as any;
    const { error } = await supabase.from('dispatch_orders').delete().eq('id', id);
    if (error) {
      throw new NotFoundException(error.message);
    }
  }

  async getStats() {
    const orders = await this.findAll();
    return {
      totalDispatchOrders: orders.length,
      pendingDispatchOrders: orders.filter((order) => order.status === 'pending').length,
      urgentDispatchOrders: orders.filter((order) =>
        ['urgent', 'critical'].includes(order.priority),
      ).length,
    };
  }

  private toDispatchOrder(row: DispatchOrderRow) {
    return {
      id: row.id,
      reportId: row.report_id,
      operationId: row.operation_id,
      assignedTo: row.assigned_to,
      priority: row.priority,
      instructions: row.instructions ?? undefined,
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
