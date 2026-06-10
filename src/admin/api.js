import { supabase } from '../lib/supabase.js';

// All admin data goes through the `admin` Edge Function, which holds the
// service-role key server-side and verifies the caller is an admin. The
// logged-in user's JWT is attached automatically by functions.invoke.
export async function adminCall(body) {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) {
    const status = error.context?.status;
    let msg = error.message || 'Request failed';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* ignore */ }
    // Admin access was revoked (or never granted): kick the session out.
    if (status === 403 || /forbidden|not an admin/i.test(msg)) {
      window.dispatchEvent(new CustomEvent('orbit:admin-revoked'));
    }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const adminOverview = () => adminCall({ action: 'overview' });
export const adminAuthUsers = () => adminCall({ action: 'authUsers' });
export const adminUpdateContact = (id, status) => adminCall({ action: 'updateContact', id, status });
export const adminSendContactReply = ({ id, subject, message }) =>
  adminCall({ action: 'sendContactReply', id, subject, message });

// Generic allowlisted read. opts: { table, select, filters, order, ascending, limit, offset, count }
export const adminQuery = (opts) => adminCall({ action: 'query', ...opts });

// Convenience: a single count via the query action (head not needed; we read count).
export async function adminCount(table, filters = []) {
  const res = await adminQuery({ table, select: 'id', filters, limit: 1, count: true });
  return res.count ?? 0;
}
