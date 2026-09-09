import { createClient } from '@supabase/supabase-js'

// Support both VITE_* (local dev) and SUPABASE_* (Vercel-Supabase integration)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL) as string
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY) as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured.')
}

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

export type Household = {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export type HouseholdMember = {
  id: string
  household_id: string
  user_id: string
  role: string
  email: string
  joined_at: string
}

export type Store = {
  id: string
  household_id: string
  name: string
  color: string
  created_at: string
}

export type Receipt = {
  id: string
  household_id: string
  store_id: string | null
  scanned_at: string
  receipt_date: string
  total_amount: number
  tax_amount: number
  image_url: string | null
  notes: string | null
  // joined
  store?: Store
  /** Line-item count, when the query asked for it. See `fetchReceipts`. */
  item_count?: number
}

export type ReceiptItem = {
  id: string
  receipt_id: string
  item_name: string
  item_number: string | null
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  category: string
  matched_item_id: string | null
}

export type Item = {
  id: string
  household_id: string
  name: string
  item_number: string | null
  category: string
  created_at: string
}

export type ItemPrice = {
  id: string
  item_id: string
  store_id: string | null
  unit_price: number
  purchased_at: string
  receipt_id: string | null
}

export type ItemAlias = {
  id: string
  household_id: string
  item_id: string
  store_id: string | null
  receipt_name: string
  item_number: string | null
}

export type MonthlySpend = {
  month: string
  total: number
}

export type StoreMonthlySpend = {
  store_id: string
  store_name: string
  month: string
  total: number
}

export const CATEGORIES = [
  'Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry',
  'Beverages', 'Snacks', 'Household', 'Personal Care', 'Baby', 'Pet', 'Other',
] as const

export type Category = typeof CATEGORIES[number]
