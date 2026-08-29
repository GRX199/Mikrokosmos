import { getSupabase, isSupabaseConfigured } from '@/core/services/supabase';
import type { Memory } from '@/models';
import { mockMemories, nextMockId } from './mockStore';

/**
 * Memories — the trio's shared scrapbook of moments done together
 * (Phase 2). Dual-mode like every repository: Supabase when configured,
 * in-memory mock otherwise.
 */

export interface MemoryInput {
  title: string;
  caption: string;
  image_url?: string | null;
  trend_id?: string | null;
}

export async function fetchMemories(): Promise<Memory[]> {
  if (!isSupabaseConfigured) {
    return [...mockMemories].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await getSupabase()
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Memory[];
}

export async function createMemory(createdBy: string, input: MemoryInput): Promise<Memory> {
  if (!isSupabaseConfigured) {
    const memory: Memory = {
      id: nextMockId(),
      title: input.title,
      caption: input.caption,
      image_url: input.image_url ?? null,
      trend_id: input.trend_id ?? null,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
    mockMemories.unshift(memory);
    return memory;
  }
  const { data, error } = await getSupabase()
    .from('memories')
    .insert({
      title: input.title,
      caption: input.caption,
      image_url: input.image_url ?? null,
      trend_id: input.trend_id ?? null,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Memory;
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<Memory, 'title' | 'caption' | 'image_url'>>
): Promise<void> {
  if (!isSupabaseConfigured) {
    const memory = mockMemories.find((m) => m.id === id);
    if (memory) Object.assign(memory, patch);
    return;
  }
  const { error } = await getSupabase().from('memories').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteMemory(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockMemories.findIndex((m) => m.id === id);
    if (idx >= 0) mockMemories.splice(idx, 1);
    return;
  }
  const { error } = await getSupabase().from('memories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Live sync so saved moments appear for everyone instantly. */
export function subscribeToMemories(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  // Unique channel per subscriber (same pattern as trends.ts).
  const channel = getSupabase()
    .channel(`mikrokosmos-memories-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, onChange)
    .subscribe();
  return () => {
    getSupabase().removeChannel(channel);
  };
}
