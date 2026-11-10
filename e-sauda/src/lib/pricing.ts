import { supabase } from './supabase'
import { Category } from '../types'

export interface PriceSuggestion {
  low: number
  median: number
  high: number
  sampleSize: number
  // Whether the sample was narrowed to the same sub-category (more specific,
  // e.g. "iPhone" within "Mobiles") or fell back to the whole category.
  matchedSubCategory: boolean
}

const MIN_SAMPLE_SIZE = 3

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function pricesFor(category: Category, subCategory?: string): Promise<number[]> {
  let query = supabase.from('listings').select('price').eq('status', 'active').eq('category', category)
  if (subCategory) query = query.eq('sub_category', subCategory)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row: any) => Number(row.price)).filter((p) => p > 0)
}

// Called from the Sell wizard once category (and optionally sub-category) is known.
// Tries the narrower sub-category match first for a more relevant range (e.g. "iPhone"
// listings specifically rather than all of "Mobiles"), and only falls back to the
// whole category if there aren't enough sub-category listings to make that meaningful.
// Returns null rather than a misleading range when there simply isn't enough data yet —
// a marketplace this new won't have deep price history in every category.
export async function suggestPrice(
  category: Category,
  subCategory?: string,
): Promise<PriceSuggestion | null> {
  if (subCategory) {
    const narrow = await pricesFor(category, subCategory)
    if (narrow.length >= MIN_SAMPLE_SIZE) {
      const sorted = [...narrow].sort((a, b) => a - b)
      return {
        low: sorted[0],
        median: median(sorted),
        high: sorted[sorted.length - 1],
        sampleSize: sorted.length,
        matchedSubCategory: true,
      }
    }
  }

  const broad = await pricesFor(category)
  if (broad.length < MIN_SAMPLE_SIZE) return null

  const sorted = [...broad].sort((a, b) => a - b)
  return {
    low: sorted[0],
    median: median(sorted),
    high: sorted[sorted.length - 1],
    sampleSize: sorted.length,
    matchedSubCategory: false,
  }
}
