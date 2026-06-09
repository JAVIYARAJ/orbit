import { ArrowRight, Sparkles, Zap, Users, BarChart3, GitBranch, Lock, Keyboard, Check, FolderOpen, CheckSquare, Calendar, FileText, Search, Sliders, Timer, Cpu, Layers, Share2, FileCode, Eye, ChevronDown, Star, Quote, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

// Resolve the landing's initial theme: a saved preference wins, otherwise
// default to dark.
const initialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('orbit:landingTheme');
  return saved === 'light' ? 'light' : 'dark';
};

// Marketing landing page (ported from the former orbit_product_page Next.js app).
// `onEnter` leaves the landing view and drops into the app's auth gates —
// a logged-in user lands on the dashboard, otherwise the auth login page.
export function LandingPage({ onEnter, onNavigate }) {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [theme, setTheme] = useState(initialTheme);

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('orbit:landingTheme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const enter = (e) => {
    if (e) e.preventDefault();
    onEnter?.();
  };

  return (
    <div className={`orbit-landing min-h-screen bg-background text-foreground selection:bg-primary/30${isDark ? ' dark' : ''}`}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-primary/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="font-heading font-black text-2xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
            Orbit
          </div>
          <div className="hidden md:flex gap-12 text-sm font-semibold">
            <a href="#features" className="text-foreground/70 hover:text-primary transition relative group">
              Features
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#how-it-works" className="text-foreground/70 hover:text-primary transition relative group">
              How It Works
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#testimonials" className="text-foreground/70 hover:text-primary transition relative group">
              Testimonials
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="#faq" className="text-foreground/70 hover:text-primary transition relative group">
              FAQ
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/50 group-hover:w-full transition-all duration-300"></span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground/70 hover:text-primary border border-primary/15 hover:border-primary/40 bg-background/50 backdrop-blur-xl transition-all hover:scale-105"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => enter()} className="text-sm text-foreground/70 hover:text-primary transition font-semibold">Sign in</button>
            <button onClick={() => enter()} className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full font-bold hover:shadow-lg hover:shadow-primary/40 transition-all hover:scale-105">
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Creative Design */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-32 lg:py-48 overflow-hidden">
        {/* Animated background elements - Orbit theme */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/10 rounded-full animate-[spin_60s_linear_infinite] opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/20 rounded-full animate-[spin_40s_linear_infinite_reverse] opacity-70">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full blur-[2px] shadow-[0_0_20px_rgba(139,92,246,1)]" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/30 rounded-full animate-[spin_20s_linear_infinite]">
           <div className="absolute bottom-0 right-1/4 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-secondary-foreground rounded-full shadow-lg" />
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/30 to-primary/5 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute -bottom-40 left-1/4 w-96 h-96 bg-gradient-to-tr from-secondary/50 via-transparent to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-6xl mx-auto relative z-10 flex flex-col items-center text-center">
          <div className="space-y-10 flex flex-col items-center">
            {/* Badge with animation */}
            <div className="inline-block">
              <span className="px-5 py-2.5 rounded-full bg-background/50 backdrop-blur-xl border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] text-sm font-bold text-primary inline-flex items-center gap-2 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all cursor-pointer group">
                <Sparkles className="w-4 h-4 group-hover:rotate-12 group-hover:scale-110 transition-all text-primary" />
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Introducing Orbit V1</span>
              </span>
            </div>

            {/* Main Heading - Bold and Creative */}
            <h1 className="font-heading text-6xl sm:text-7xl lg:text-8xl font-black leading-[1.1] tracking-tight">
              <span className="block text-foreground drop-shadow-sm">One Workspace.</span>
              <span className="block bg-gradient-to-r from-primary via-primary/90 to-primary/60 bg-clip-text text-transparent drop-shadow-md">
                Zero Context.
              </span>
            </h1>

            {/* Description */}
            <p className="text-xl sm:text-2xl text-foreground/70 max-w-3xl font-light leading-relaxed">
              Stop context switching between GitHub, Vercel, Slack, and a dozen other tools. Consolidate every workflow into one keyboard-first workspace built for developers.
            </p>

            {/* Primary CTA — auth is Google-only, so this routes straight to sign-in
                rather than capturing an email. */}
            <div className="pt-8">
              <button onClick={() => enter()} className="group relative px-8 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-lg rounded-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1 inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-primary/50">
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-2 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              </button>
            </div>
            <p className="text-sm text-foreground/50 font-medium">Join 10,000+ developers already on board.</p>
            {/* Stats with creative design */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 pt-16 border-t border-primary/10 w-full">
              {[
                { number: '16+', label: 'Integrated Modules', icon: '⚙️' },
                { number: '10x', label: 'Faster Switching', icon: '⚡' },
                { number: '99.9%', label: 'Uptime SLA', icon: '🛡️' },
              ].map((stat, i) => (
                <div key={i} className="group">
                  <div className="flex flex-col items-center text-center gap-2 sm:flex-row sm:justify-center sm:text-left sm:gap-3">
                    <span className="text-3xl">{stat.icon}</span>
                    <div className="text-center sm:text-left">
                      <div className="text-4xl font-black text-primary group-hover:scale-110 transition duration-300">{stat.number}</div>
                      <p className="text-sm text-foreground/60 mt-1">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section - Creative Comparison */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-32 bg-gradient-to-b from-background via-secondary/10 to-background border-t border-primary/5">
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="font-heading text-5xl sm:text-6xl font-black text-center mb-20">
            Stop Juggling <span className="text-primary">12 Apps</span>
          </h2>

          <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 items-center">
            {/* Without Orbit */}
            <div className="p-8 rounded-3xl bg-red-500/5 border-2 border-red-500/10 backdrop-blur-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
              <h3 className="font-heading text-3xl font-black text-foreground/80 mb-8 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                Before Orbit
              </h3>
              <div className="space-y-4 relative z-10">
                {[
                  { item: 'GitHub for code', icon: '📂' },
                  { item: 'Vercel for deploys', icon: '🚀' },
                  { item: 'Linear for tasks', icon: '✓' },
                  { item: 'Slack for chat', icon: '💬' },
                  { item: 'Notion for notes', icon: '📝' },
                ].map((problem, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/50 dark:bg-black/50 border border-red-500/20 shadow-sm hover:-translate-x-1 hover:border-red-500/50 transition-all">
                    <span className="text-2xl opacity-70 grayscale group-hover:grayscale-0 transition-all">{problem.icon}</span>
                    <span className="font-medium text-foreground/70">{problem.item}</span>
                    <span className="ml-auto text-red-500 font-bold bg-red-500/10 w-6 h-6 rounded-full flex items-center justify-center text-sm">×</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-red-500/10">
                <p className="text-sm text-foreground/60 font-medium">12 tabs open. Zero focus. Endless context switching.</p>
              </div>
            </div>

            {/* Middle Arrow */}
            <div className="hidden lg:flex justify-center items-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500/20 to-primary/20 flex items-center justify-center border border-primary/20 shadow-lg relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <ArrowRight className="w-8 h-8 text-primary relative z-10" />
              </div>
            </div>

            {/* With Orbit */}
            <div className="p-8 rounded-3xl bg-primary/5 border-2 border-primary/20 backdrop-blur-sm relative group overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.05)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all"></div>
              <h3 className="font-heading text-3xl font-black text-primary mb-8 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.8)]"></span>
                After Orbit
              </h3>
              <div className="space-y-4 relative z-10">
                {[
                  { item: '16 modules in one place', icon: '⭐' },
                  { item: 'Cmd+K instant access', icon: '⚡' },
                  { item: 'Real-time sync', icon: '🔄' },
                  { item: 'Team collaboration', icon: '👥' },
                  { item: 'Native integrations', icon: '🔗' },
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-background border-2 border-primary/30 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.1)] hover:translate-x-1 hover:border-primary transition-all">
                    <span className="text-2xl drop-shadow-md">{benefit.icon}</span>
                    <span className="font-bold text-foreground">{benefit.item}</span>
                    <div className="ml-auto bg-primary/20 w-6 h-6 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary font-bold" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-primary/20">
                <p className="text-sm text-primary font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  One unified workspace. Zero friction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Features Grid - Creative Design */}
      <section id="features" className="relative px-4 sm:px-6 lg:px-8 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.05)_0%,transparent_70%)] -z-10" />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-heading text-6xl sm:text-7xl font-black mb-6">
              Superpowers for <span className="text-primary">Developers</span>
            </h2>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto font-light text-center">
              Built for speed, designed for collaboration, made for developers who ship fast.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Keyboard,
                title: 'Keyboard-First',
                desc: 'Cmd+K anywhere. Your hands never leave the keyboard.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Zap,
                title: 'Lightning Fast',
                desc: 'Optimized for speed. Built with React 19 & Vite.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Users,
                title: 'Team Collab',
                desc: 'Real-time sync. Workspace permissions. Scale instantly.',
                color: 'from-green-500 to-emerald-500',
              },
              {
                icon: BarChart3,
                title: 'Deep Insights',
                desc: 'Work analytics, project health, time distribution.',
                color: 'from-yellow-500 to-orange-500',
              },
              {
                icon: GitBranch,
                title: 'GitHub Native',
                desc: 'Repos, PRs, commits—all in one place.',
                color: 'from-indigo-500 to-purple-500',
              },
              {
                icon: Lock,
                title: 'Vault Secure',
                desc: 'AES-256 encryption for all sensitive data.',
                color: 'from-red-500 to-pink-500',
              },
            ].map((feature, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
                className="group relative p-8 rounded-2xl bg-background/50 backdrop-blur-lg border border-primary/10 hover:border-primary/50 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer"
              >
                {/* Gradient blur effect */}
                <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-15 rounded-full blur-3xl transition duration-500`}></div>

                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition duration-300 shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="font-heading text-xl font-bold mb-3 group-hover:text-primary transition">{feature.title}</h3>
                <p className="text-foreground/70 leading-relaxed text-sm">{feature.desc}</p>

                {/* Hover indicator */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section - Grid with Stagger */}
      <section id="how-it-works" className="relative px-4 sm:px-6 lg:px-8 py-32 bg-gradient-to-b from-background via-secondary/10 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-32 bg-primary/20 blur-[100px] -z-10 rounded-[100%]" />
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-widest uppercase mb-6 border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
              Unified Ecosystem
            </span>
            <h2 className="font-heading text-6xl sm:text-7xl lg:text-8xl font-black mb-8 leading-[1.1] tracking-tighter">
              <span className="text-foreground">16 Modules.</span><br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/50 bg-clip-text text-transparent drop-shadow-sm">One Platform.</span>
            </h2>
            <p className="text-2xl text-foreground/70 max-w-3xl mx-auto font-light leading-relaxed text-center">
              All the tools your team needs to ship faster, collaborate better, and build amazing products without ever switching tabs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Projects', Icon: FolderOpen, desc: 'Manage milestones, sprints, and entire epics with ease.' },
              { name: 'Tasks', Icon: CheckSquare, desc: 'Track every to-do, bug, and feature request seamlessly.' },
              { name: 'Calendar', Icon: Calendar, desc: "Synchronize your team's schedule and critical deadlines." },
              { name: 'Notes', Icon: FileText, desc: 'Document ideas and technical specs in real-time.' },
              { name: 'GitHub Sync', Icon: GitBranch, desc: 'Deep integration with your repositories and PRs.' },
              { name: 'Vercel Deploy', Icon: Layers, desc: 'Monitor your deployments and production build status.' },
              { name: 'Analytics', Icon: BarChart3, desc: "Visualize your team's velocity and sprint throughput." },
              { name: 'Team Hub', Icon: Users, desc: 'Centralized communication and team directory.' },
              { name: 'Vault', Icon: Lock, desc: 'Securely store and share environment variables.' },
              { name: 'Time Track', Icon: Timer, desc: "Log hours and optimize your team's workflow." },
              { name: 'Automation', Icon: Sliders, desc: 'Set up custom rules to eliminate manual busywork.' },
              { name: 'API Manager', Icon: Cpu, desc: 'Design, mock, and test your REST and GraphQL endpoints.' },
              { name: 'Collaborate', Icon: Share2, desc: 'Real-time multiplayer editing and whiteboarding.' },
              { name: 'Reports', Icon: FileCode, desc: 'Generate automated progress and project health reports.' },
              { name: 'Views', Icon: Eye, desc: 'Custom Kanban, list, table, and board configurations.' },
              { name: 'Search', Icon: Search, desc: 'Universal Cmd+K across all your workspace data.' },
            ].map((module, i) => (
              <div
                key={i}
                className="group relative p-6 rounded-2xl bg-background/60 backdrop-blur-md border border-primary/10 hover:border-primary/50 hover:bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer overflow-hidden flex flex-col text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition duration-500" />

                <div className="relative z-10 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all duration-300">
                    <module.Icon className="w-6 h-6 text-primary group-hover:text-white transition duration-300" />
                  </div>
                </div>

                <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">{module.name}</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">{module.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="relative px-4 sm:px-6 lg:px-8 py-32 bg-gradient-to-b from-background via-secondary/5 to-background border-t border-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Social Proof</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-black mb-6">Loved by Dev Teams</h2>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto text-center">Join hundreds of teams who ditched context switching</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Priya Nair',
                role: 'Engineering Lead',
                avatar: '👩🏽‍💻',
                text: 'Orbit replaced five separate tools for my team. Having GitHub, tasks, and our deploys in one window cut our standups in half.',
                rating: 5,
              },
              {
                name: 'Rohan Mehta',
                role: 'Full Stack Developer',
                avatar: '👨🏽‍💻',
                text: 'The Cmd+K shortcuts are a game changer. I jump between projects, notes, and the timer without ever touching my mouse.',
                rating: 5,
              },
              {
                name: 'Ananya Iyer',
                role: 'CTO',
                avatar: '👩🏽‍💼',
                text: 'We onboarded the whole team in a day. Workspace permissions and the encrypted vault gave us exactly the control we needed.',
                rating: 5,
              },
            ].map((testimonial, i) => (
              <div key={i} className="p-8 rounded-2xl bg-background/80 backdrop-blur-md border border-primary/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 group">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <Quote className="w-6 h-6 text-primary/50 mb-4" />

                <p className="text-foreground/80 mb-6 italic leading-relaxed">"{testimonial.text}"</p>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-foreground/60">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack - Creative Cards */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Technology</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-black mb-6">
              Built on <span className="text-primary">Modern Tech</span>
            </h2>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto font-light text-center">
              Leveraging the best open-source and bleeding-edge technologies for speed and reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'React 19', desc: 'Server components, Suspense, and the latest React capabilities.', badge: '⚛️' },
              { name: 'Vite 6', desc: 'Lightning-fast build tool with hot module replacement.', badge: '⚡' },
              { name: 'PostgreSQL', desc: 'Robust relational database with advanced query performance.', badge: '🗄️' },
              { name: 'TypeScript', desc: 'Full type safety across the entire application codebase.', badge: '📘' },
              { name: 'Supabase', desc: 'Open-source Firebase alternative with PostgreSQL backend.', badge: '🚀' },
              { name: 'WebSockets', desc: 'Real-time bidirectional communication for live collaboration.', badge: '🔄' },
            ].map((tech, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-background/50 backdrop-blur-xl border border-primary/20 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)] hover:-translate-y-2"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-heading text-2xl font-bold text-primary">{tech.name}</h3>
                  <span className="text-3xl group-hover:scale-125 transition duration-300">{tech.badge}</span>
                </div>
                <p className="text-foreground/70 leading-relaxed">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative px-4 sm:px-6 lg:px-8 py-32 bg-gradient-to-b from-background to-background">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Questions?</p>
            <h2 className="font-heading text-4xl sm:text-5xl font-black mb-6">Frequently Asked</h2>
            <p className="text-xl text-foreground/70">Everything you need to know about Orbit</p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: 'What exactly is Orbit?',
                answer: 'Orbit is a single workspace for developers that brings projects, tasks, a calendar, notes, time tracking, analytics, and your GitHub and Vercel activity together in one place — so you stop switching between a dozen separate tools to get work done.',
              },
              {
                question: 'How do I sign in to Orbit?',
                answer: 'Orbit uses Google sign-in. Click Get Started, authenticate with your Google account, and you are in — there is no separate password to create or manage.',
              },
              {
                question: 'Which tools does Orbit integrate with?',
                answer: 'Orbit connects to GitHub (repositories, pull requests, and commits), Vercel (deployments and build status), and Google Calendar, so your code, releases, and schedule all live right next to your projects and tasks.',
              },
              {
                question: 'Can I use Orbit with my team?',
                answer: 'Yes. Create a workspace, invite teammates by email, and control what each member can access with role-based permissions. Everyone works from the same shared workspace.',
              },
              {
                question: 'How secure is the Vault?',
                answer: 'The Vault uses client-side, end-to-end encryption: your secrets are encrypted on your device before they are ever stored, so they are never readable on the server — a zero-knowledge design.',
              },
              {
                question: 'What is Orbit built on?',
                answer: 'A modern React 19 and Vite front end backed by Supabase (PostgreSQL) for data, authentication, and storage — fast to load and reliable to run.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="border-2 border-primary/10 rounded-xl overflow-hidden hover:border-primary/50 transition"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/50 transition"
                >
                  <span className="font-heading font-bold text-lg text-foreground">{item.question}</span>
                  <ChevronDown
                    className={`w-6 h-6 text-primary transition duration-300 ${expandedFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedFaq === i && (
                  <div className="px-6 py-4 bg-secondary/30 border-t-2 border-primary/10">
                    <p className="text-foreground/70 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Bold Design */}
      <section id="pricing" className="relative px-4 sm:px-6 lg:px-8 py-40 overflow-hidden border-t border-primary/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15)_0%,transparent_100%)] -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse"></div>

        <div className="max-w-5xl mx-auto relative text-center space-y-12">
          <h2 className="font-heading text-6xl sm:text-7xl lg:text-8xl font-black leading-tight tracking-tight">
            Ready to <span className="text-primary drop-shadow-md">escape tool hell?</span>
          </h2>

          <p className="text-2xl sm:text-3xl text-foreground/70 max-w-3xl mx-auto font-light leading-relaxed text-center">
            Join hundreds of dev teams who ditched the context-switching nightmare. Orbit is the unified workspace you&apos;ve been waiting for.
          </p>

          <div className="flex justify-center pt-8">
            <button onClick={() => enter()} className="group px-10 py-5 bg-gradient-to-r from-primary to-primary/80 text-white font-black text-xl rounded-2xl hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all duration-300 hover:-translate-y-1 inline-flex items-center justify-center gap-3">
              Get Started
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition" />
            </button>
          </div>

          <p className="text-lg text-foreground/70 font-medium pt-4">
            Start for free • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 px-4 sm:px-6 lg:px-8 py-12 bg-background">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <div className="font-heading font-black text-xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Orbit
            </div>
            <p className="text-sm text-foreground/60 mt-1">One workspace for developers.</p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-foreground/70">
            <a href="#features" className="hover:text-primary transition">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition">How It Works</a>
            <a href="#testimonials" className="hover:text-primary transition">Testimonials</a>
            <a href="#faq" className="hover:text-primary transition">FAQ</a>
            <button onClick={() => onNavigate?.('/privacy')} className="hover:text-primary transition">Privacy</button>
          </nav>
        </div>

        <div className="max-w-7xl mx-auto border-t border-primary/10 mt-8 pt-8 text-center">
          <p className="text-sm text-foreground/60">&copy; {new Date().getFullYear()} Orbit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
