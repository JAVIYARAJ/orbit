import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// ── Data hook ───────────────────────────────────────────────────
export function useAdmin(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.resolve(fetcher())
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message || String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(load, [load]);
  return { data, loading, error, reload: load };
}

// ── Time formatting ─────────────────────────────────────────────
export function relativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
export function absTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
export const RelTime = ({ date }) => (
  <span title={absTime(date)} className="text-muted-foreground whitespace-nowrap">{relativeTime(date)}</span>
);

// ── Badge ───────────────────────────────────────────────────────
const TONES = {
  indigo: 'bg-primary/15 text-primary border-primary/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  grey: 'bg-muted text-muted-foreground border-border',
  blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  purple: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
};
export function Badge({ tone = 'grey', children, dot }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TONES[tone] || TONES.grey}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusTone(status) {
  const s = (status || '').toLowerCase();
  if (['resolved', 'accepted', 'completed', 'done', 'active'].includes(s)) return 'green';
  if (['new', 'pending', 'planning'].includes(s)) return 'yellow';
  if (['seen', 'in_progress', 'review'].includes(s)) return 'blue';
  if (['cancelled', 'expired', 'deleted', 'on_hold', 'hold'].includes(s)) return s === 'expired' ? 'red' : 'grey';
  return 'grey';
}

// ── Skeleton ────────────────────────────────────────────────────
export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-muted/60 ${className}`} />
);

// ── Stat card ───────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, hint, loading }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/40 backdrop-blur-md border border-white/5 p-6 flex flex-col gap-1 hover:border-primary/30 transition-all duration-300 group hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors"></div>
      <div className="flex items-center justify-between relative z-10 mb-2">
        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
        {Icon && <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform"><Icon className="w-4 h-4" /></div>}
      </div>
      <div className="relative z-10">
        {loading
          ? <Skeleton className="h-10 w-24 mt-1" />
          : <span className="text-4xl font-heading font-black tracking-tight block bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">{value}</span>}
      </div>
      {hint && <span className="text-xs text-muted-foreground relative z-10 mt-2 font-medium">{hint}</span>}
    </div>
  );
}

// ── Progress bar ────────────────────────────────────────────────
export const ProgressBar = ({ value = 0 }) => (
  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

// ── Avatar ──────────────────────────────────────────────────────
export function Avatar({ name, url, size = 32 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (url) return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>
  );
}

// ── Inputs ──────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full sm:w-72 pl-9 pr-4 py-2.5 rounded-xl bg-card/40 backdrop-blur-sm border border-white/5 text-sm font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
      />
    </div>
  );
}
export function FilterSelect({ value, onChange, options, allLabel = 'All' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2.5 rounded-xl bg-card/40 backdrop-blur-sm border border-white/5 text-sm font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 capitalize transition-all cursor-pointer">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value} className="bg-background">
          {typeof o === 'string' ? o.replace(/_/g, ' ') : o.label}
        </option>
      ))}
    </select>
  );
}
export const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
    <span className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-muted'}`}
      onClick={() => onChange(!checked)}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-4.5 left-[18px]' : 'left-0.5'}`} />
    </span>
    {label}
  </label>
);

// ── Table ───────────────────────────────────────────────────────
export function DataTable({ columns, rows, loading, error, onRetry, onRowClick, dense, emptyText = 'No records found.' }) {
  if (error) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-md p-10 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        )}
      </div>
    );
  }
  const pad = dense ? 'px-4 py-3' : 'px-6 py-4';
  return (
    <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-md overflow-hidden shadow-xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="text-sm w-full">
          <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl">
            <tr className="border-b border-white/5 text-left">
              {columns.map((c) => (
                <th key={c.key} className={`${pad} font-bold text-muted-foreground uppercase tracking-wider text-xs whitespace-nowrap ${c.thClassName || ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {columns.map((c) => <td key={c.key} className={pad}><Skeleton className="h-4 w-full max-w-[160px]" /></td>)}
                  </tr>
                ))
              : (rows && rows.length)
                ? rows.map((row, i) => (
                    <tr key={row.id || i}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`border-b border-white/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''} transition-colors font-medium`}>
                      {columns.map((c) => (
                        <td key={c.key} className={`${pad} ${c.tdClassName || ''}`}>
                          {c.render ? c.render(row) : (row[c.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))
                : <tr><td colSpan={columns.length} className="px-6 py-16 text-center text-muted-foreground font-medium">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────
export function Pagination({ offset, limit, count, onPage }) {
  if (count == null) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(count / limit));
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>{count === 0 ? '0' : `${offset + 1}–${Math.min(offset + limit, count)}`} of {count}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(offset - limit)}
          className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/40"><ChevronLeft className="w-4 h-4" /></button>
        <span>Page {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(offset + limit)}
          className="p-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/40"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Drawer ──────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-background/95 backdrop-blur-3xl border-l border-white/5 shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8 border-b border-white/5 shrink-0 bg-background/50">
          <div className="min-w-0">
            <h3 className="text-2xl font-heading font-black truncate bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground truncate mt-1 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/5 shrink-0 transition-colors border border-transparent hover:border-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">{open && children}</div>
      </div>
    </div>
  );
}

// Small labelled field for drawers
export const Field = ({ label, children }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
    <div className="text-sm">{children ?? '—'}</div>
  </div>
);
export const DrawerSection = ({ title, children, count }) => (
  <div>
    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">{title}{count != null && <span className="text-xs text-muted-foreground font-normal">({count})</span>}</h4>
    {children}
  </div>
);
