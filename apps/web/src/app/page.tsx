'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Code2, Timer, BarChart3, Shield,
  Check, Sparkles, Users, Building2, Zap, Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatedCounter } from "@/components/animated-counter";
import { StatusBadge } from "@/components/status-badge";

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass border-b border-border" : "border-b border-transparent bg-background/40"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#stats" className="hover:text-foreground transition-colors">Why us</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#testimonials" className="hover:text-foreground transition-colors">Customers</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link href="/login">
            <Button size="sm" className="gradient-brand text-white hover:opacity-90 border-0">
              Get started <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="absolute left-1/2 top-32 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-[#3B82F6]/20 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
        >
          <Sparkles className="h-3 w-3 text-[#3B82F6]" />
          New · Real-time coding monitoring is here
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          className="mx-auto max-w-4xl text-5xl font-bold tracking-tight md:text-7xl"
        >
          Assess. Evaluate.{" "}
          <span className="gradient-text">Hire Better.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
        >
          The developer-first assessment platform. Build real coding rounds with Monaco, timed MCQs, live proctoring, and beautiful analytics — all in one polished workspace.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/login">
            <Button size="lg" className="gradient-brand text-white hover:opacity-90 border-0 shadow-lg shadow-[#3B82F6]/25">
              Get started free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">View demo</Button>
          </Link>
        </motion.div>

        {/* Floating preview cards */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="glass relative overflow-hidden rounded-2xl shadow-2xl border border-border"
          >
            <div className="flex items-center gap-2 border-b border-border bg-card/60 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#22C55E]/70" />
              </div>
              <div className="ml-3 text-xs text-muted-foreground">assesscode.app / exam / dsa-final</div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="font-mono text-[#F59E0B] font-bold">01:42:18</span>
                <StatusBadge tone="success" dot>Live</StatusBadge>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0 text-left bg-card/40">
              <div className="col-span-12 md:col-span-3 border-r border-border p-4">
                <div className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Questions</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const colors = ["bg-[#3B82F6]/20 border-[#3B82F6]/40 text-[#3B82F6]","bg-muted","bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]","bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]"];
                    const c = colors[i % 4];
                    return <div key={i} className={`grid h-7 w-7 place-items-center rounded border text-[10px] font-semibold ${c}`}>{i + 1}</div>;
                  })}
                </div>
              </div>
              <div className="col-span-12 md:col-span-9 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3 w-3" /> two_sum.py · Python
                </div>
                <pre className="font-mono text-[11px] leading-5 text-foreground/90 overflow-x-auto p-3 bg-background/50 rounded-lg">
{`def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        c = target - n
        if c in seen:
            return [seen[c], i]
        seen[n] = i
    return []`}
                </pre>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs">
                  <StatusBadge tone="success" dot>3/3 tests passed</StatusBadge>
                  <span className="ml-auto text-muted-foreground">Saved 2s ago</span>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
            className="glass absolute -left-6 -top-10 hidden w-56 rounded-xl p-4 md:block text-left"
          >
            <div className="text-xs text-muted-foreground">Avg. score</div>
            <div className="mt-1 text-2xl font-bold">87.4<span className="text-sm text-muted-foreground font-normal">/100</span></div>
            <div className="mt-2 text-xs text-[#22C55E] font-medium">▲ 4.2% this week</div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.55 }}
            className="glass absolute -right-6 -bottom-8 hidden w-60 rounded-xl p-4 md:block text-left animate-fade-up"
          >
            <div className="mb-2 text-xs text-muted-foreground font-medium">Live monitoring</div>
            <div className="space-y-2">
              {[["Sadiq R.", 78], ["Aanya S.", 92], ["Marcus C.", 45]].map(([n, p]) => (
                <div key={n as string} className="flex items-center gap-2 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                  <span className="w-20 truncate">{n}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full gradient-brand" style={{ width: `${p}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Timer, title: "Timer-based exams", desc: "Per-section timers, auto-submit, late penalties, and resume protection — built in." },
    { icon: Code2, title: "Real code editor", desc: "Monaco-powered editor with Python, Java, C++, and JS. Run code against hidden tests in a sandbox." },
    { icon: BarChart3, title: "Deep analytics", desc: "Score distributions, question-level difficulty, cohort comparisons, and exportable reports." },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-14 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">Platform</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Everything an engineering team needs</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">From the first MCQ to the final hiring decision — without leaving the dashboard.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-[#3B82F6]/40 text-left border border-border"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] group-hover:gradient-brand group-hover:text-white transition-colors">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { n: 10000, suffix: "+", label: "Assessments delivered" },
    { n: 500, suffix: "+", label: "Companies trust us" },
    { n: 99.9, suffix: "%", label: "Uptime SLA", decimals: 1 },
    { n: 42, suffix: "ms", label: "Avg. judge latency" },
  ];
  return (
    <section id="stats" className="border-y border-border bg-surface/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-x divide-border md:grid-cols-4 md:divide-y-0">
        {items.map((s) => (
          <div key={s.label} className="px-6 py-10 text-center">
            <div className="text-3xl font-bold tracking-tight md:text-4xl">
              <AnimatedCounter value={s.n} suffix={s.suffix} decimals={s.decimals ?? 0} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground md:text-sm font-medium">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    { q: "We moved off HackerRank in a week. AssessCode's editor feels like VS Code — candidates actually enjoy the round.", n: "Maya Patel", r: "Head of Engineering, Lumen" },
    { q: "The monitoring dashboard caught two policy violations on day one. Worth every dollar.", n: "Derek Kim", r: "VP Talent, Northwind" },
    { q: "Built our entire university hiring pipeline on it. The analytics tell us exactly which questions to keep.", n: "Aanya Sharma", r: "University Recruiter, Helix Labs" },
  ];
  return (
    <section id="testimonials" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-12 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">Loved by teams</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Trusted across engineering</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {quotes.map((t, i) => (
          <motion.div key={t.n}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass rounded-2xl p-6 text-left border border-border bg-card"
          >
            <div className="text-sm leading-relaxed text-foreground/90 font-medium">"{t.q}"</div>
            <div className="mt-5 flex items-center gap-3 border-t border-border/40 pt-4">
              <div className="grid h-9 w-9 place-items-center rounded-full gradient-brand text-xs font-semibold text-white">
                {t.n.split(" ").map(s => s[0]).join("")}
              </div>
              <div>
                <div className="text-sm font-bold">{t.n}</div>
                <div className="text-xs text-muted-foreground">{t.r}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter", price: "$0", period: "/mo",
      desc: "For small teams trying things out.",
      features: ["Up to 25 candidates / mo", "MCQ + coding rounds", "Basic analytics", "Email support"],
      cta: "Start free", highlight: false,
    },
    {
      name: "Pro", price: "$199", period: "/mo",
      desc: "For growing engineering orgs.",
      features: ["Unlimited candidates", "Live monitoring + replays", "Advanced analytics & exports", "Custom question bank", "Priority support"],
      cta: "Start 14-day trial", highlight: true,
    },
    {
      name: "Enterprise", price: "Custom", period: "",
      desc: "For regulated and large-scale hiring.",
      features: ["SSO + SAML", "On-prem judge", "Dedicated CSM", "Custom integrations", "SLAs & audit logs"],
      cta: "Talk to sales", highlight: false,
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-14 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#3B82F6]">Pricing</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Plans for every stage</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Start free. Upgrade when you're ready. Cancel anytime.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className={`relative rounded-2xl ${t.highlight ? "p-[1px] gradient-brand" : "border border-border bg-card"}`}>
            <div className={`flex h-full flex-col rounded-2xl p-6 text-left ${t.highlight ? "border-transparent bg-card" : ""}`}>
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Most popular
                </div>
              )}
              <div className="text-sm font-semibold text-muted-foreground">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              <ul className="my-6 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-[#22C55E] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button className={`mt-auto w-full ${t.highlight ? "gradient-brand text-white border-0 hover:opacity-90" : "border border-border hover:bg-accent"}`} variant={t.highlight ? "default" : "outline"}>
                {t.cta}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-5 text-left">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The premium technical assessment platform built for serious engineering teams.
          </p>
          <div className="mt-4 flex gap-3 text-muted-foreground">
            <a href="#" aria-label="GitHub Link" className="hover:text-foreground">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/></svg>
            </a>
            <a href="#" aria-label="Twitter Link" className="hover:text-foreground">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
            </a>
            <a href="#" aria-label="LinkedIn Link" className="hover:text-foreground">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>
        </div>
        {[
          { t: "Product", l: ["Features", "Pricing", "Changelog", "Roadmap"] },
          { t: "Company", l: ["About", "Customers", "Careers", "Press"] },
          { t: "Resources", l: ["Docs", "API", "Status", "Security"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-sm font-semibold">{c.t}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.l.map((x) => <li key={x}><a href="#" className="hover:text-foreground">{x}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <div>© 2026 AssessCode, Inc. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Nav />
      <Hero />
      <Features />
      <Stats />
      <Testimonials />
      <Pricing />
      <Footer />
    </div>
  );
}
