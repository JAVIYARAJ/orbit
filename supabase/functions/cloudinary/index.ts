// cloudinary — signs direct browser uploads and destroys assets. The API secret
// never reaches the client. Mirrors the google-calendar-proxy auth conventions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLOUD_NAME   = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
const API_KEY      = Deno.env.get('CLOUDINARY_API_KEY')!
const API_SECRET   = Deno.env.get('CLOUDINARY_API_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function sha1Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
// Cloudinary signature = SHA1( "k1=v1&k2=v2"(sorted) + api_secret )
async function sign(params: Record<string, string | number>): Promise<string> {
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  return sha1Hex(toSign + API_SECRET)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { action, workstation_id, public_id, attachment_id } = await req.json()

    const authHeader = req.headers.get('Authorization')!
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const isMember = async (ws: string) => {
      const { data } = await admin.from('workstation_members').select('role')
        .eq('workstation_id', ws).eq('user_id', user.id).maybeSingle()
      return data
    }

    if (action === 'sign') {
      if (!workstation_id || !public_id) return json({ error: 'missing params' }, 400)
      if (!(await isMember(workstation_id))) return json({ error: 'Unauthorized' }, 403)
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await sign({ public_id, timestamp })
      return json({ data: { signature, timestamp, api_key: API_KEY, cloud_name: CLOUD_NAME, public_id } })
    }

    if (action === 'destroy') {
      if (!attachment_id) return json({ error: 'missing attachment_id' }, 400)
      const { data: att } = await admin.from('task_attachments')
        .select('workstation_id, uploaded_by, public_id, resource_type')
        .eq('id', attachment_id).maybeSingle()
      if (!att) return json({ error: 'not_found' }, 404)
      if (!(await isMember(att.workstation_id))) return json({ error: 'Unauthorized' }, 403)

      let canDelete = att.uploaded_by === user.id
      if (!canDelete) {
        const [{ data: del }, { data: edit }] = await Promise.all([
          userClient.rpc('has_workspace_permission', { p_workstation_id: att.workstation_id, p_action: 'delete_task' }),
          userClient.rpc('has_workspace_permission', { p_workstation_id: att.workstation_id, p_action: 'edit_task' }),
        ])
        canDelete = del === true || edit === true
      }
      if (!canDelete) return json({ error: 'permission_denied' }, 403)

      // Destroy the Cloudinary asset (best-effort), then remove the DB row.
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await sign({ public_id: att.public_id, timestamp })
      const form = new FormData()
      form.set('public_id', att.public_id)
      form.set('api_key', API_KEY)
      form.set('timestamp', String(timestamp))
      form.set('signature', signature)
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${att.resource_type || 'image'}/destroy`, {
        method: 'POST', body: form,
      }).catch(() => {})

      await admin.from('task_attachments').delete().eq('id', attachment_id)
      return json({ data: { ok: true } })
    }

    return json({ error: `unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
