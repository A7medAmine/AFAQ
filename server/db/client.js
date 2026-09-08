import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder'
)

export function sanitizeFilter(val) {
  if (!val || typeof val !== 'string') return ''
  return val.replace(/[,().%*:\\]/g, ' ').trim()
}
