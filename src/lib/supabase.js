import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, {
  auth: {
    // PKCE returns the session as a `?code=...` query param (exchanged for a
    // session by detectSessionInUrl) instead of the implicit flow's `#access_token`
    // URL fragment — cleaner URLs and the recommended flow for SPAs.
    flowType: 'pkce',
    // Required for PKCE: lets the client auto-exchange the ?code on the redirect
    // back from Google. (true is the default; kept explicit since the flow depends on it.)
    detectSessionInUrl: true,
  },
})
