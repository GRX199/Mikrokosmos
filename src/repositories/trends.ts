import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Trend, TrendStatus, TrendTask } from '@/models';
import {
  mockTrendParticipants,
  mockTrendTasks,
  mockTrends,
  nextMockId,
} from './mockStore';

/** Shared trends + their checklists. */

export async function fetchTrends(): Promise<Trend[]> {
  if (!isSupabaseConfigured) {
    return [...mockTrends].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }
  const { data, error } = await getSupabase()
    .from('trends')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Trend[];
}

export interface TrendInput {
  title: string;
  description?: string | null;
  url?: string | null;
  target_date?: string | null;
  participant_ids?: string[];
}

export async function createTrend(createdBy: string, input: TrendInput): Promise<Trend> {
  if (!isSupabaseConfigured) {
    const trend: Trend = {
      id: nextMockId(),
      title: input.title,
      description: input.description ?? null,
      url: input.url ?? null,
      created_by: createdBy,
      status: 'idea',
      target_date: input.target_date ?? null,
      created_at: new Date().toISOString(),
    };
    mockTrends.unshift(trend);
    mockTrendParticipants[trend.id] = input.participant_ids ?? [createdBy];
    return trend;
  }
  const { data, error } = await getSupabase()
    .from('trends')
    .insert({
      title: input.title,
      description: input.description ?? null,
      url: input.url ?? null,
      created_by: createdBy,
      target_date: input.target_date ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const trend = data as Trend;

  const participants = input.participant_ids ?? [createdBy];
  if (participants.length) {
    await getSupabase().from('trend_participants').insert(
      participants.map((user_id) => ({ trend_id: trend.id, user_id }))
    );
  }
  return trend;
}

export async function updateTrendStatus(id: string, status: TrendStatus): Promise<void> {
  if (!isSupabaseConfigured) {
    const trend = mockTrends.find((t) => t.id === id);
    if (trend) trend.status = status;
    return;
  }
  const { error } = await getSupabase().from('trends').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTrend(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockTrends.findIndex((t) => t.id === id);
    if (idx >= 0) mockTrends.splice(idx, 1);
    delete mockTrendParticipants[id];
    return;
  }
  const { error } = await getSupabase().from('trends').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchParticipants(trendIds: string[]): Promise<Record<string, string[]>> {
  if (!trendIds.length) return {};
  if (!isSupabaseConfigured) {
    const map: Record<string, string[]> = {};
    for (const id of trendIds) map[id] = mockTrendParticipants[id] ?? [];
    return map;
  }
  const { data, error } = await getSupabase()
    .from('trend_participants')
    .select('trend_id,user_id')
    .in('trend_id', trendIds);
  if (error) throw new Error(error.message);
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (map[row.trend_id] ??= []).push(row.user_id);
  }
  return map;
}

/** Count of done trends per member (profile stats). */
export async function fetchCompletedTrendsCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return mockTrends.filter((t) => t.status === 'done').length;
  }
  const { data, error } = await getSupabase()
    .from('trends')
    .select('id,trend_participants(user_id)')
    .eq('status', 'done');
  if (error) throw new Error(error.message);
  return (data ?? []).filter((t: { trend_participants?: { user_id: string }[] }) =>
    t.trend_participants?.some((p) => p.user_id === userId)
  ).length;
}

// ---------- Tasks (shared checklist) ----------

export async function fetchTasks(trendId: string): Promise<TrendTask[]> {
  if (!isSupabaseConfigured) return mockTrendTasks.filter((t) => t.trend_id === trendId);
  const { data, error } = await getSupabase()
    .from('trend_tasks')
    .select('*')
    .eq('trend_id', trendId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrendTask[];
}

export async function addTask(trendId: string, title: string): Promise<void> {
  if (!isSupabaseConfigured) {
    mockTrendTasks.push({ id: nextMockId(), trend_id: trendId, title, completed: false });
    return;
  }
  const { error } = await getSupabase().from('trend_tasks').insert({ trend_id: trendId, title });
  if (error) throw new Error(error.message);
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
  completedBy: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    const task = mockTrendTasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = completed;
      task.completed_by = completed ? completedBy : null;
    }
    return;
  }
  const { error } = await getSupabase()
    .from('trend_tasks')
    .update({ completed, completed_by: completed ? completedBy : null })
    .eq('id', taskId);
  if (error) throw new Error(error.message);
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockTrendTasks.findIndex((t) => t.id === taskId);
    if (idx >= 0) mockTrendTasks.splice(idx, 1);
    return;
  }
  const { error } = await getSupabase().from('trend_tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
}

/** Live sync for trend tasks + statuses across the three friends. */
export function subscribeToTrendChanges(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = getSupabase()
    .channel('mikrokosmos-trends')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trend_tasks' }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trends' }, onChange)
    .subscribe();
  return () => {
    getSupabase().removeChannel(channel);
  };
}
