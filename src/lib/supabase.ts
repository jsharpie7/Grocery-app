import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Database types
export type Household = {
  id: string
  name: string
  join_code: string
  created_at: string
}

export type Store = {
  id: string
  household_id: string
  name: string
  logo_url: string | null
  color: string
  display_order: number
  is_active: boolean
  created_at: string
}

export type Category = {
  id: string
  household_id: string | null
  name: string
  icon: string
  is_default: boolean
}

export type Item = {
  id: string
  household_id: string
  name: string
  category_id: string | null
  photo_url: string | null
  barcode: string | null
  created_at: string
  // Joined fields
  category?: Category
}

export type StoreItem = {
  id: string
  store_id: string
  item_id: string
  typical_price: number | null
  typical_quantity: number
  unit: string
  purchase_count: number
  last_purchased_at: string | null
  // Joined fields
  item?: Item
}

export type ListItem = {
  id: string
  household_id: string
  store_id: string
  item_id: string
  quantity: number
  unit: string
  is_checked: boolean
  added_at: string
  added_by: string | null
  // Joined fields
  item?: Item
}

export type Trip = {
  id: string
  household_id: string
  store_id: string
  started_at: string
  ended_at: string | null
  total_spent: number | null
  receipt_photo_url: string | null
}

export type TripItem = {
  id: string
  trip_id: string
  item_id: string
  quantity: number
  unit: string
  price_paid: number | null
  // Joined fields
  item?: Item
}

export type ShoppingOrder = {
  id: string
  store_id: string
  item_id: string
  average_position: number
  sample_count: number
}
