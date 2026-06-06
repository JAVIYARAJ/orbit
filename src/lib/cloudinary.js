import { supabase } from './supabase.js'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024 // 100 MB (allows short videos)

async function callEdge(body) {
  const { data, error } = await supabase.functions.invoke('cloudinary', { body })
  if (error) throw new Error(error.message || 'Cloudinary error')
  if (data?.error) throw new Error(data.error)
  return data?.data ?? data
}

// Uploads a file straight to Cloudinary (signed by our edge function) and returns
// the metadata to persist via add_task_attachment.
export async function uploadAttachment(file, { workstationId, taskDbId }) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is larger than 100 MB`)
  }
  const publicId = `orbit/${workstationId}/${taskDbId}/${crypto.randomUUID()}`
  const { signature, timestamp, api_key, cloud_name, public_id } = await callEdge({
    action: 'sign', workstation_id: workstationId, public_id: publicId,
  })

  const form = new FormData()
  form.set('file', file)
  form.set('api_key', api_key)
  form.set('timestamp', String(timestamp))
  form.set('signature', signature)
  form.set('public_id', public_id)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`, {
    method: 'POST', body: form,
  })
  const r = await res.json()
  if (!res.ok || r.error) throw new Error(r.error?.message || 'Upload failed')

  return {
    provider: 'cloudinary',
    public_id: r.public_id,
    resource_type: r.resource_type || 'image',
    secure_url: r.secure_url,
    file_name: file.name,
    mime_type: file.type || null,
    format: r.format || null,
    size_bytes: r.bytes ?? file.size,
    width: r.width ?? null,
    height: r.height ?? null,
  }
}

export const destroyAttachment = (attachmentId) =>
  callEdge({ action: 'destroy', attachment_id: attachmentId })

export const isImageAttachment = (att) =>
  att?.resourceType === 'image' && (att?.format || '').toLowerCase() !== 'pdf'

// Build an optimized thumbnail URL via Cloudinary transformations.
export function thumbUrl(att, w = 280, h = 280) {
  if (!att?.secureUrl || att.resourceType !== 'image') return null
  return att.secureUrl.replace('/upload/', `/upload/c_fill,w_${w},h_${h},q_auto,f_auto/`)
}

export function formatBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const cloudinaryConfigured = () => !!CLOUD_NAME
