import { createClient } from '@supabase/supabase-js'

let _supabase = null

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
  }
  return _supabase
}

export default new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop]
  }
})
