import { motion } from 'framer-motion';
import { LayoutDashboard, ShieldCheck, ArrowRight } from 'lucide-react';

// Shown right after login ONLY when the signed-in account is both a normal
// user and an admin. Lets them pick which surface to enter.
export function RoleChooser({ user, onUser, onAdmin }) {
  const name = (user?.name || user?.email || 'there').split('@')[0];
  return (
    <div className="orbit-landing dark min-h-screen flex items-center justify-center bg-background text-foreground px-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[140px] -z-10 animate-pulse pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl text-center"
      >
        <div className="font-heading font-black text-2xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent mb-3">Orbit</div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black mb-2">Welcome back, {name}</h1>
        <p className="text-foreground/60 mb-10">You have admin access. How would you like to continue?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Choice
            onClick={onUser}
            icon={LayoutDashboard}
            title="Continue as User"
            desc="Open your workspace — projects, tasks, calendar and more."
            cta="Go to app"
          />
          <Choice
            onClick={onAdmin}
            icon={ShieldCheck}
            title="Continue as Admin"
            desc="Manage users, workstations, activity and submissions."
            cta="Open admin panel"
            highlight
          />
        </div>

        <p className="text-xs text-foreground/40 mt-8">You can switch anytime — admins can always reopen the panel at <span className="font-mono">/admin</span>.</p>
      </motion.div>
    </div>
  );
}

function Choice({ onClick, icon: Icon, title, desc, cta, highlight }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group text-left p-6 rounded-2xl border transition-all duration-300 flex flex-col ${
        highlight
          ? 'bg-gradient-to-br from-primary/15 to-transparent border-primary/40 hover:border-primary hover:shadow-[0_0_40px_rgba(139,92,246,0.25)]'
          : 'bg-background/50 border-primary/15 hover:border-primary/50 hover:shadow-xl'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${highlight ? 'bg-primary text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 'bg-primary/10 text-primary'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-heading text-xl font-bold mb-1">{title}</h3>
      <p className="text-sm text-foreground/60 flex-1">{desc}</p>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-primary mt-4 group-hover:gap-3 transition-all">
        {cta} <ArrowRight className="w-4 h-4" />
      </span>
    </motion.button>
  );
}
