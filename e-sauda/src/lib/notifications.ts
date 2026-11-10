import { supabase } from './supabase'
import { AppNotification } from '../types'
import { RealtimeChannel } from '@supabase/supabase-js'

function mapRow(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.read,
    createdAt: row.created_at,
  }
}

// Powers the bell dropdown. Capped at 30 -- this is a notification feed, not an
// archive; older ones are still in the DB if we ever want a "see all" page.
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
}

// Live-updates the bell the moment a trigger inserts a row (new message, report status
// change, etc.) -- no polling needed. Call the returned function on unmount.
export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: AppNotification) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(mapRow(payload.new)),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
