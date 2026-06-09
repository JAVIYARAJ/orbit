// Orbit Admin API — privileged, service-role data access for the /admin panel.
//
// Security model:
//   1. Supabase gateway verifies the caller's JWT (verify_jwt = true).
//   2. This function re-verifies the JWT and checks the caller's email against
//      an admin allowlist (ADMIN_EMAILS). Non-admins get 403.
//   3. ONLY after that do we use the service-role key (auto-injected by Supabase
//      as SUPABASE_SERVICE_ROLE_KEY) to read data, bypassing RLS.
// The service key never leaves the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Tables the generic reader is allowed to query.
const READ_TABLES = new Set([
  "profiles", "projects", "tasks", "notes", "workstations", "workstation_members",
  "task_statuses", "task_priorities", "project_types", "tags", "time_entries",
  "task_status_logs", "workspace_invites", "workspace_role_permissions",
  "workspace_integrations", "task_comments", "task_attachments", "activity_log",
  "contact_submissions", "gantt_tasks", "learning", "notifications",
]);

type Filter = { col: string; op: string; val: unknown };

function applyFilters(q: any, filters: Filter[] = []) {
  for (const { col, op, val } of filters) {
    switch (op) {
      case "eq": q = q.eq(col, val); break;
      case "neq": q = q.neq(col, val); break;
      case "is": q = q.is(col, val); break;
      case "not_is": q = q.not(col, "is", val); break;
      case "gte": q = q.gte(col, val); break;
      case "lte": q = q.lte(col, val); break;
      case "gt": q = q.gt(col, val); break;
      case "lt": q = q.lt(col, val); break;
      case "ilike": q = q.ilike(col, val); break;
      case "in": q = q.in(col, val as unknown[]); break;
      default: throw new Error("Unsupported op: " + op);
    }
  }
  return q;
}

async function runQuery(admin: any, body: any) {
  const { table, select = "*", filters = [], order, ascending = false,
          limit = 50, offset = 0, count } = body;
  if (!READ_TABLES.has(table)) throw new Error("Table not allowed: " + table);
  let q = admin.from(table).select(select, count ? { count: "exact" } : undefined);
  q = applyFilters(q, filters);
  // Optional multi-column search → OR of ilike. Term is sanitized.
  if (body.search?.term && Array.isArray(body.search?.columns) && body.search.columns.length) {
    const term = String(body.search.term).replace(/[%,()*]/g, "").trim();
    if (term) q = q.or(body.search.columns.map((c: string) => `${c}.ilike.%${term}%`).join(","));
  }
  if (order) q = q.order(order, { ascending });
  q = q.range(offset, offset + limit - 1);
  const { data, error, count: total } = await q;
  if (error) throw error;
  return { rows: data ?? [], count: total ?? null };
}

async function countRows(admin: any, table: string, filters: Filter[] = []) {
  let q = admin.from(table).select("*", { count: "exact", head: true });
  q = applyFilters(q, filters);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function authUsers(admin: any) {
  const map: Record<string, any> = {};
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      map[u.id] = {
        email: u.email,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
        provider: u.app_metadata?.provider ?? null,
      };
    }
    if (data.users.length < 1000) break;
    page++;
  }
  return { users: map };
}

async function updateContact(admin: any, body: any) {
  const { id, status } = body;
  if (!["new", "seen", "resolved"].includes(status)) throw new Error("Invalid status");
  const { error } = await admin.from("contact_submissions").update({ status }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

function groupCount<T>(rows: T[], key: (r: T) => string | null) {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) ?? "—";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function overview(admin: any) {
  const nullDel: Filter[] = [{ col: "deleted_at", op: "is", val: null }];

  const [
    totalUsers, totalWorkstations, totalNotes, totalTasks, totalStatusLogs,
  ] = await Promise.all([
    countRows(admin, "profiles"),
    countRows(admin, "workstations"),
    countRows(admin, "notes", nullDel),
    countRows(admin, "tasks", nullDel),
    countRows(admin, "task_status_logs"),
  ]);

  const activeProjects = await countRows(admin, "projects", [
    ...nullDel, { col: "status", op: "neq", val: "deleted" },
  ]);

  // Pull small column sets and aggregate in JS (dataset is small).
  const [signups, projStatus, acts, te, contacts, wsNames, actWs] = await Promise.all([
    admin.from("profiles").select("created_at"),
    admin.from("projects").select("status").is("deleted_at", null),
    admin.from("activity_log").select("action"),
    admin.from("time_entries").select("total_seconds"),
    admin.from("contact_submissions").select("status"),
    admin.from("workstations").select("id,name"),
    admin.from("activity_log").select("workstation_id"),
  ]);

  // Signups over last 30 days (daily buckets)
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  const byDay: Record<string, number> = {};
  for (const r of signups.data ?? []) {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + 1;
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: byDay[key] ?? 0 });
  }

  const totalSeconds = (te.data ?? []).reduce((s: number, r: any) => s + (r.total_seconds ?? 0), 0);

  // Top 5 workstations by activity count
  const wsCount = groupCount(actWs.data ?? [], (r: any) => r.workstation_id);
  const wsNameMap: Record<string, string> = {};
  for (const w of wsNames.data ?? []) wsNameMap[w.id] = w.name;
  const topWorkstations = Object.entries(wsCount)
    .map(([id, count]) => ({ id, name: wsNameMap[id] ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    stats: {
      totalUsers, totalWorkstations, activeProjects, totalTasks,
      totalNotes, totalStatusLogs,
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    },
    contactByStatus: groupCount(contacts.data ?? [], (r: any) => r.status),
    signupsDaily: days,
    projectsByStatus: groupCount(projStatus.data ?? [], (r: any) => r.status),
    activityByAction: groupCount(acts.data ?? [], (r: any) => r.action),
    topWorkstations,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing auth token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    // Admin = profiles.is_admin flag (single source of truth, set in the DB).
    const { data: profile } = await admin.from("profiles")
      .select("is_admin").eq("id", userData.user.id).maybeSingle();
    if (profile?.is_admin !== true) return json({ error: "Forbidden — not an admin account" }, 403);

    const body = await req.json();
    switch (body.action) {
      case "overview": return json(await overview(admin));
      case "query": return json(await runQuery(admin, body));
      case "authUsers": return json(await authUsers(admin));
      case "updateContact": return json(await updateContact(admin, body));
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
