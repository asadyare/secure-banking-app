import { Link } from "react-router-dom";
import {
  Infinity as InfinityIcon,
  ChevronDown,
  Zap,
  PiggyBank,
  Headphones,
  Check,
  Shield,
  Lock,
  ScanEye,
  Twitter,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HERO_IMG =
  "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=900&q=80";
const FEATURE_IMG =
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80";
const SECURE1 =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80";
const SECURE3 =
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=600&q=80";

const nav = [
  { label: "Home", href: "#top" },
  { label: "About Us", href: "#about", hasCaret: true },
  { label: "Blogs", href: "#blogs", hasCaret: true },
  { label: "Tech", href: "#tech", hasCaret: true },
];

const scrollTo = (id: string) => {
  const el = document.getElementById(id.replace("#", ""));
  el?.scrollIntoView({ behavior: "smooth" });
};

export default function Landing() {
  return (
    <div id="top" className="min-h-screen bg-[#050508] text-zinc-100 antialiased selection:bg-fuchsia-500/30">
      {/* ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[520px] w-[520px] rounded-full bg-fuchsia-600/15 blur-[120px]" />
        <div className="absolute -right-1/4 top-1/3 h-[480px] w-[480px] rounded-full bg-violet-600/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-purple-900/25 blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-20 border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/25">
              <InfinityIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-white">Baawisan Bank</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => scrollTo(item.href)}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
                {item.hasCaret ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : null}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="hidden text-zinc-300 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:opacity-95"
            >
              <Link to="/auth">Contact Us</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-12 md:grid-cols-2 md:items-center md:px-6 lg:pt-16">
        <div className="space-y-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-400/90">
            Digital banking · Reimagined
          </p>
          <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            BANK SMARTER
            <br />
            EVERY DAY
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-zinc-400">
            Move money with clarity. Baawisan Bank brings real-time balances, instant transfers, and a
            security-first platform—so you stay in control whether you&apos;re on mobile or desktop.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-gradient-to-r from-fuchsia-500 via-fuchsia-500 to-violet-600 px-8 text-base font-semibold text-white shadow-[0_0_40px_-8px_rgba(217,70,239,0.65)] hover:opacity-95"
            >
              <Link to="/auth">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10"
            >
              <a href="#features">
                Explore features <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-fuchsia-500/20 via-transparent to-violet-500/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/50">
            <img
              src={HERO_IMG}
              alt=""
              className="aspect-[4/5] w-full object-cover md:aspect-[5/6]"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent opacity-60 md:opacity-40" />
          </div>

          {/* floating stats */}
          <div className="absolute -bottom-4 left-2 right-2 flex flex-col gap-3 sm:-right-8 sm:left-auto sm:top-8 sm:w-64">
            {[
              { t: "10k+", s: "Transfers processed daily" },
              { t: "120+", s: "Partner networks" },
              { t: "50k+", s: "Active users", avatars: true },
            ].map((row) => (
              <div
                key={row.s}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a10]/90 px-4 py-3 shadow-xl backdrop-blur-md"
              >
                <div className="text-lg font-bold text-fuchsia-400">{row.t}</div>
                <div className="flex-1 text-xs leading-snug text-zinc-400">
                  {row.s}
                  {"avatars" in row && row.avatars ? (
                    <div className="mt-2 flex -space-x-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-7 w-7 rounded-full border-2 border-[#0a0a10] bg-gradient-to-br from-fuchsia-500/80 to-violet-600/80"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 scroll-mt-24 border-t border-white/5 bg-black/20 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-2 md:items-center md:px-6">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10">
            <img src={FEATURE_IMG} alt="" className="aspect-[5/6] w-full object-cover sm:aspect-video md:aspect-[4/5]" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/80 to-transparent" />
          </div>
          <div className="space-y-8">
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
              We Bring Smarter Banking Features
            </h2>
            <ul className="space-y-6">
              {[
                {
                  icon: Zap,
                  title: "Instant payments",
                  desc: "Send money between your accounts in seconds with real-time balance updates.",
                },
                {
                  icon: PiggyBank,
                  title: "Smart savings",
                  desc: "Organize goals and track progress with clear, readable account snapshots.",
                },
                {
                  icon: Headphones,
                  title: "24/7 support",
                  desc: "Self-serve tools first—reach out when you need a human in the loop.",
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/90 to-violet-600 shadow-lg shadow-fuchsia-500/20">
                    <f.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-white">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Check className="h-6 w-6 shrink-0 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-100/90">
                100k+ successful transfers in our demo environment
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Digital access */}
      <section id="about" className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">Seamless digital access</h2>
              <p className="mt-2 max-w-xl text-zinc-400">
                One experience across web and mobile—built for speed, clarity, and control.
              </p>
            </div>
            <Button
              asChild
              className="w-fit rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/20"
            >
              <Link to="/auth">Download the app</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Personalized control",
                desc: "See every account and transfer in one calm, focused dashboard.",
                highlight: true,
              },
              {
                title: "Real-time sync",
                desc: "Balances and activity refresh as soon as you take action.",
              },
              {
                title: "Built for teams",
                desc: "Business profiles and workflows when you scale beyond personal banking.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className={`rounded-2xl border p-6 backdrop-blur-sm transition hover:border-fuchsia-500/30 ${
                  c.highlight
                    ? "border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-500/10 to-transparent shadow-[0_0_50px_-20px_rgba(217,70,239,0.5)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <h3 className="font-heading text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{c.desc}</p>
                {c.highlight ? (
                  <Link to="/auth" className="mt-4 inline-flex text-sm font-medium text-fuchsia-400 hover:text-fuchsia-300">
                    Learn more →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-zinc-500">
            60k+ people use our demo experience each month · <span className="text-zinc-400">Join Baawisan Bank</span>
          </p>
        </div>
      </section>

      {/* Security */}
      <section id="tech" className="relative z-10 border-t border-white/5 bg-black/30 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="font-heading text-center text-3xl font-bold text-white md:text-4xl">
            We protect your data everywhere
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
            Defense in depth: modern auth, encrypted transport, and strict access patterns—aligned with how we
            built this app.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <img src={SECURE1} alt="" className="h-40 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <Shield className="mb-2 h-8 w-8 text-fuchsia-400" />
                <h3 className="font-heading font-semibold text-white">Compliance-minded design</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Row-level security and server-side transfers—so client apps can&apos;t fake balances.
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-violet-950/50 to-[#050508] p-8 text-center">
              <Lock className="mx-auto mb-4 h-10 w-10 text-violet-400" />
              <p className="font-heading text-2xl font-bold tracking-wide text-white md:text-3xl">
                TLS + strong auth
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Sessions handled by Supabase Auth; traffic encrypted in transit to our API.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <img src={SECURE3} alt="" className="h-40 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <ScanEye className="mb-2 h-8 w-8 text-fuchsia-400" />
                <h3 className="font-heading font-semibold text-white">Activity you can audit</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Immutable transaction history and clear descriptions for every movement of funds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business CTA */}
      <section id="blogs" className="relative z-10 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-violet-600/10 px-6 py-14 text-center">
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">Empower your business</h2>
          <p className="mx-auto mt-3 max-w-lg text-zinc-400">
            Open an account, move money, and scale with the same Baawisan Bank experience—demo-ready today.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-10 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/25"
          >
            <Link to="/auth">Get started</Link>
          </Button>
          <p className="mt-6 text-sm font-medium text-emerald-400/90">99% on-time delivery · demo SLA</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#020204] py-14">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 md:flex-row md:items-start md:justify-between md:px-6">
          <div>
            <div className="flex items-center gap-2">
              <InfinityIcon className="h-8 w-8 text-fuchsia-400" />
              <span className="font-heading text-xl font-bold text-white">Baawisan Bank</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-zinc-500">
              A modern banking UI demo. Not a chartered bank—built for learning and product exploration.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:border-fuchsia-500/40 hover:text-fuchsia-400"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:border-fuchsia-500/40 hover:text-fuchsia-400"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-8 text-sm">
            {["Home", "Collections", "Lookbook", "About", "Blog"].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => scrollTo("top")}
                className="text-zinc-500 transition hover:text-white"
              >
                {l}
              </button>
            ))}
          </div>
          <div className="w-full max-w-md md:w-auto">
            <p className="text-sm font-medium text-white">Stay in the loop</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <Input
                type="email"
                placeholder="Enter your email address"
                className="h-11 border-white/15 bg-white/5 text-white placeholder:text-zinc-500"
              />
              <Button type="submit" className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 text-white">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-7xl px-4 text-center text-xs text-zinc-600 md:px-6">
          © {new Date().getFullYear()} Baawisan Bank demo. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
