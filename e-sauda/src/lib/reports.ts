import { supabase } from './supabase'

export type ReportReason =
  | 'scam_or_fraud'
  | 'prohibited_item'
  | 'misleading'
  | 'harassment'
  | 'spam'
  | 'other'

export const reportReasonLabels: Record<ReportReason, string> = {
  scam_or_fraud: 'Scam or fraud',
  prohibited_item: 'Prohibited or illegal item',
  misleading: 'Misleading listing (fake photos, wrong condition, etc.)',
  harassment: 'Harassment or abusive behavior',
  spam: 'Spam or fake account',
  other: 'Something else',
}

export interface SubmitReportInput {
  reporterId: string
  listingId?: string
  reportedUserId?: string
  reason: ReportReason
  details?: string
}

export async function submitReport(input: SubmitReportInput): Promise<void> {
  if (!input.listingId && !input.reportedUserId) {
    throw new Error('Report must reference a listing or a user.')
  }
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    listing_id: input.listingId ?? null,
    reported_user_id: input.reportedUserId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  })
  if (error) throw error
}
