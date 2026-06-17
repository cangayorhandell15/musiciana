import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Siguraduhing may laman ang mga environment variables bago paganahin
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables sa .env.local!')
}

// Ito ang gagamitin natin sa buong app para sa Realtime, Auth, at Database Queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Para hindi kailangang mag-login ulit tuwing magre-refresh ng page
    autoRefreshToken: true,
  },
})