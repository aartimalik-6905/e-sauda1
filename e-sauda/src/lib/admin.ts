import { supabase } from './supabase'
import { ReportReason } from './reports'

export interface AdminReport {
  id: string
  reason: ReportReason
  details: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  createdAt: string
  reporterId: string
  reporterName: string
  reportedUserId: string | null
  reportedUserName: string | null
  reportedUserSuspended: boolean
  listingId: string | null
  listingTitle: string | null
  listingStatus: string | null
}

// Deliberately not using PostgREST embedded selects (e.g. `listing:listings(title)`) --
// `reports.reported_user_id` references `auth.users`, not `public.profiles`, so
// PostgREST can't auto-detect that relationship for an embed. Two small `.in()` lookups
// and stitching client-side is simpler than working around that, and this is an admin
// page loaded rarely, not a hot path worth over-optimizing.
export async function fetchReports(status: 'open' | 'reviewed' | 'dismissed' | 'all' = 'open'): Promise<AdminReport[]> {
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data: reports, error } = await query
  if (error) throw error
  if (!reports || reports.length === 0) return []

  const userIds = Array.from(
    new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean))),
  )
  const listingIds = Array.from(new Set(reports.map((r) => r.listing_id).filter(Boolean)))

  const [{ data: profiles }, { data: listings }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name, suspended').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    listingIds.length
      ? supabase.from('listings').select('id, title, status').in('id', listingIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]))

  return reports.map((r) => {
    const listing = r.listing_id ? listingById.get(r.listing_id) : undefined
    const reportedProfile = r.reported_user_id ? profileById.get(r.reported_user_id) : undefined
    return {
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      reporterId: r.reporter_id,
      reporterName: profileById.get(r.reporter_id)?.display_name ?? 'Unknown',
      reportedUserId: r.reported_user_id,
      reportedUserName: reportedProfile?.display_name ?? (r.reported_user_id ? 'Unknown' : null),
      reportedUserSuspended: reportedProfile?.suspended ?? false,
      listingId: r.listing_id,
      listingTitle: listing?.title ?? null,
      listingStatus: listing?.status ?? null,
    }
  })
}

export async function updateReportStatus(id: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('reports').update({ status }).eq('id', id)
  if (error) throw error
}

// Sets a listing to 'removed' -- same status a seller's own delete-listing path could
// reach, just triggered by an admin instead. Doesn't hard-delete the row, so its chat
// history and past chats stay intact for anyone who needs to look back at them.
export async function removeListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)
  if (error) throw error
}

// Flips profiles.suspended. RLS (moderation_actions_schema.sql) then stops that user
// from posting new listings or sending new messages -- existing content is untouched.
export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ suspended }).eq('id', userId)
  if (error) throw error
}
