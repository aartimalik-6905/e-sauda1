import { supabase } from './supabase'

export interface BlockedUser {
  id: string
  displayName: string
  blockedAt: string
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId })
  if (error) throw error
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  if (error) throw error
}

// Only tells you who *you've* blocked -- RLS means you can never see who's blocked
// you, same privacy reasoning as reports.
//
// Two separate queries rather than an embedded select (e.g.
// `profiles!blocked_users_blocked_id_fkey(display_name)`) -- blocked_id references
// auth.users, not public.profiles, so PostgREST can't auto-detect that relationship
// for an embed. Same reasoning as fetchReports in lib/admin.ts.
export async function fetchMyBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data: rows, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in(
      'id',
      rows.map((r) => r.blocked_id),
    )
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]))

  return rows.map((r) => ({
    id: r.blocked_id,
    displayName: nameById.get(r.blocked_id) ?? 'Unknown',
    blockedAt: r.created_at,
  }))
}

export async function amIBlocking(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()
  if (error) throw error
  return !!data
}
