"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

const steps = [
  { id: "clone",       num: "01", title: "Clone the Repository",             color: "text-blue-400",    accent: "border-blue-500/40" },
  { id: "credentials", num: "02", title: "Create Google Cloud Credentials",  color: "text-violet-400",  accent: "border-violet-500/40" },
  { id: "config",      num: "03", title: "Place Credentials in /config",     color: "text-emerald-400", accent: "border-emerald-500/40" },
  { id: "secrets",     num: "04", title: "Generate Secrets",                 color: "text-sky-400",     accent: "border-sky-500/40" },
  { id: "backend",     num: "05", title: "Start the Backend",                color: "text-teal-400",    accent: "border-teal-500/40" },
  { id: "frontend",    num: "06", title: "Start the Frontend",               color: "text-pink-400",    accent: "border-pink-500/40" },
  { id: "connect",     num: "07", title: "Connect Drive Accounts",           color: "text-amber-400",   accent: "border-amber-500/40" },
  { id: "scale",       num: "08", title: "Add More Accounts",                color: "text-emerald-400", accent: "border-emerald-500/40" },
];

function Code({ children }: { children: string }) {
  return <code className="rounded-lg bg-sd-s2 px-1.5 py-0.5 text-xs text-sd-accent font-mono">{children}</code>;
}

function Block({ label, children }: { label?: string; children: string }) {
  return (
    <div className="rounded-xl border border-sd-border bg-sd-bg overflow-hidden">
      {label && <div className="border-b border-sd-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sd-text3">{label}</div>}
      <pre className="overflow-x-auto px-4 py-4 text-sm text-emerald-400 font-mono leading-relaxed"><code>{children}</code></pre>
    </div>
  );
}

function Note({ type, children }: { type: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: { border: "border-blue-500/20", bg: "bg-blue-500/5",    text: "text-blue-400",    label: "Note" },
    warn: { border: "border-amber-500/20", bg: "bg-amber-500/5",  text: "text-amber-400",   label: "Important" },
    tip:  { border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400", label: "Tip" },
  }[type];
  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4`}>
      <span className={`text-xs font-bold ${styles.text}`}>{styles.label} — </span>
      <span className="text-xs text-sd-text2 leading-relaxed">{children}</span>
    </div>
  );
}

function NumberedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-sd-text2">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-sd-s3 text-[10px] font-bold text-sd-text3">{i + 1}</span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function StepHeader({ num, color, accent, title }: { num: string; color: string; accent: string; title: string }) {
  return (
    <div className={`mb-6 flex items-center gap-4 border-l-2 ${accent} pl-5`}>
      <span className={`font-mono text-xs font-bold tabular-nums ${color}`}>{num}</span>
      <h2 className="text-xl font-semibold text-sd-text">{title}</h2>
    </div>
  );
}

export default function DocsPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-sd-bg text-sd-text">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-sd-border bg-sd-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-accent" />
              <svg className="relative h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.5} />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-sd-text">StitchDrive</span>
            <span className="rounded-full border border-sd-border px-2 py-0.5 text-[10px] text-sd-text3">Docs</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-lg text-sd-text3 hover:bg-sd-s2 hover:text-sd-text transition">
              {theme === "dark"
                ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
                : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>
              }
            </button>
            <Link href="/login" className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">Open Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Hero */}
        <div className="mb-16 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sd-accent/20 bg-sd-accent/5 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sd-accent" />
            <span className="text-xs font-medium text-sd-accent">Setup Guide</span>
          </div>
          <h1 className="font-display mb-4 text-4xl text-sd-text md:text-5xl">
            Get up and running<br />
            <span className="gradient-text">in 15 minutes</span>
          </h1>
          <p className="text-lg leading-relaxed text-sd-text2">
            From zero to a fully working multi-account Google Drive dashboard. No cloud accounts, no paid services — just your machine and your Google credentials.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Node.js 18+", "MongoDB", "Google Account(s)", "Git"].map(p => (
              <span key={p} className="rounded-xl border border-sd-border bg-sd-s1 px-3 py-1.5 text-xs text-sd-text2">{p}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-12">
          {/* Sidebar nav */}
          <aside className="hidden w-48 flex-shrink-0 lg:block">
            <div className="sticky top-20">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-sd-text3">Steps</p>
              <nav className="space-y-1">
                {steps.map(s => (
                  <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-sd-text2 hover:bg-sd-s2 hover:text-sd-text transition">
                    <span className={`font-mono text-[10px] font-bold tabular-nums ${s.color}`}>{s.num}</span>
                    <span>{s.title}</span>
                  </a>
                ))}
                <div className="my-3 border-t border-sd-border" />
                <a href="#faq" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-sd-text2 hover:bg-sd-s2 hover:text-sd-text transition">
                  <span className="font-mono text-[10px] font-bold tabular-nums text-sd-text3">—</span>
                  <span>FAQ</span>
                </a>
                <a href="#troubleshooting" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-sd-text2 hover:bg-sd-s2 hover:text-sd-text transition">
                  <span className="font-mono text-[10px] font-bold tabular-nums text-sd-text3">—</span>
                  <span>Troubleshooting</span>
                </a>
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-16">
            <section id="clone">
              <StepHeader num="01" color="text-blue-400" accent="border-blue-500/40" title="Clone the Repository" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">Fork the repository on GitHub to get your own copy, then clone it locally.</p>
                <Block label="Terminal">{`git clone https://github.com/Atifhasan250/Stitch-Drive.git\ncd Stitch-Drive`}</Block>
              </div>
            </section>

            <section id="credentials">
              <StepHeader num="02" color="text-violet-400" accent="border-violet-500/40" title="Create Google Cloud Credentials" />
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-sd-text2">You only need <strong className="text-sd-text">one Google Cloud project</strong> and one credentials file — no matter how many Drive accounts you want to add.</p>
                <NumberedList items={[
                  <>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-sd-accent underline underline-offset-2">console.cloud.google.com</a> and create a <strong className="text-sd-text">new project</strong>.</>,
                  <>Navigate to <strong className="text-sd-text">APIs &amp; Services → Library</strong>, search for <strong className="text-sd-text">Google Drive API</strong>, and enable it.</>,
                  <>Go to <strong className="text-sd-text">OAuth consent screen</strong>. Choose <strong className="text-sd-text">External</strong>, add all Google accounts as test users.</>,
                  <>Go to <strong className="text-sd-text">Credentials → Create Credentials → OAuth client ID</strong>. Choose <strong className="text-sd-text">Web application</strong>. Add redirect URI: <Code>http://localhost:8000/api/auth/callback</Code></>,
                  <>Download the JSON file — you'll place it in the next step.</>,
                ]} />
                <Note type="tip">Adding all your Google accounts as test users gives them long-lived refresh tokens — no 7-day expiry.</Note>
              </div>
            </section>

            <section id="config">
              <StepHeader num="03" color="text-emerald-400" accent="border-emerald-500/40" title="Place Credentials in /config" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">Place the downloaded credentials file in the <Code>config/</Code> folder, named exactly <Code>credentials.json</Code>.</p>
                <Block label="config/ folder">{`config/\n└── credentials.json   ← your single OAuth client file`}</Block>
                <Note type="warn">The <Code>config/</Code> folder is excluded from Git — your credentials are <strong className="text-sd-text">never</strong> accidentally committed.</Note>
              </div>
            </section>

            <section id="secrets">
              <StepHeader num="04" color="text-sky-400" accent="border-sky-500/40" title="Generate Secrets" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">Install Node.js dependencies, then run the setup script. It will prompt you for a dashboard PIN and write all secrets directly into the MongoDB database.</p>
                <Block label="Install dependencies">{`cd backend\nnpm install`}</Block>
                <Block label="Generate secrets">{`node scripts/generate_secrets.js`}</Block>
                <Note type="info">All three secrets (PIN hash, JWT secret, encryption key) are stored in the <Code>app_config</Code> collection inside MongoDB.</Note>
              </div>
            </section>

            <section id="backend">
              <StepHeader num="05" color="text-teal-400" accent="border-teal-500/40" title="Start the Backend" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">The backend is a Node.js/Express app. On startup it connects to MongoDB and syncs file metadata from all connected Drive accounts.</p>
                <Block label="From the backend folder">{`npm run dev`}</Block>
                <Note type="tip">Verify by opening <span className="font-mono text-sd-accent">http://localhost:8000/api/auth/status</span> — you should get a JSON response.</Note>
              </div>
            </section>

            <section id="frontend">
              <StepHeader num="06" color="text-pink-400" accent="border-pink-500/40" title="Start the Frontend" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">The frontend is a Next.js (App Router) app. Install dependencies and start the dev server alongside the backend.</p>
                <Block label="Terminal 2">{`cd frontend\nnpm install\nnpm run dev`}</Block>
                <p className="text-sm text-sd-text2">Open <span className="font-mono text-sd-accent">http://localhost:3000</span>. Next.js rewrites all <Code>/api/*</Code> requests to <Code>http://localhost:8000/api/*</Code> automatically.</p>
              </div>
            </section>

            <section id="connect">
              <StepHeader num="07" color="text-amber-400" accent="border-amber-500/40" title="Connect Your First Drive Account" />
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-sd-text2">Each account must be authorized via Google OAuth once before StitchDrive can access it.</p>
                <NumberedList items={[
                  <>Navigate to <span className="font-mono text-sd-accent">http://localhost:3000/login</span> and enter your PIN.</>,
                  <>Click <strong className="text-sd-text">Settings</strong> in the left sidebar.</>,
                  <>Click <strong className="text-sd-text">Connect another account</strong> in the top-right.</>,
                  <>Select the Google account to add, then approve the Drive permission on the consent screen.</>,
                  <>You'll be redirected back to Settings. The new account card appears with its storage quota.</>,
                ]} />
                <Note type="info">OAuth refresh tokens are encrypted with Fernet (AES-128-CBC) before being stored — never saved in plain text.</Note>
              </div>
            </section>

            <section id="scale">
              <StepHeader num="08" color="text-emerald-400" accent="border-emerald-500/40" title="Add More Accounts" />
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-sd-text2">Adding another Drive account takes seconds — no file changes, no restart needed.</p>
                <NumberedList items={[
                  <>Go to <strong className="text-sd-text">Settings</strong> and click <strong className="text-sd-text">Connect another account</strong>.</>,
                  "Sign in with a different Google account on the OAuth screen.",
                  "You're back in Settings — the new account card is live.",
                  "Done — your pool just grew by 15 GB.",
                ]} />
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                  <p className="font-display text-3xl text-sd-text">N × 15 GB</p>
                  <p className="mt-1 text-xs text-sd-text2">No hard limit on accounts. 10 accounts = 150 GB free.</p>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq">
              <div className="mb-8">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-sd-text3">FAQ</p>
                <h2 className="font-display text-2xl text-sd-text">Frequently Asked Questions</h2>
              </div>
              <div className="divide-y divide-sd-border rounded-2xl border border-sd-border bg-sd-s1 overflow-hidden">
                {[
                  { q: "Is my data safe?", a: "Yes. StitchDrive runs entirely on your local machine. Files are stored in your own Google Drive accounts. OAuth tokens are encrypted with AES-128 (Fernet) before being written to the local database." },
                  { q: "How many accounts can I add?", a: "There is no limit. Click \"Connect another account\" in Settings for each additional Google account. Each one adds its full storage quota to the pool. 10 free accounts = 150 GB." },
                  { q: "What happens if an account is full?", a: "StitchDrive always routes to the account with the most free space. If all accounts are full, the upload fails with a 503 error. Add another account to fix it." },
                  { q: "Can I access files I added directly in Google Drive?", a: "Yes. Click Sync in the Files page to pull in new metadata — it's fast since only metadata is synced, not file content." },
                  { q: "Can I run it with Docker?", a: "Yes. Drop your credentials.json into config/, then: (1) docker compose build, (2) docker compose run --rm backend python scripts/generate_secrets.py, (3) docker compose up -d." },
                  { q: "Can I expose it on the internet?", a: "It's designed for local/self-hosted use. If you use a reverse proxy with HTTPS, update FRONTEND_URL, BACKEND_URL, and the Google OAuth redirect URIs accordingly." },
                ].map(faq => (
                  <div key={faq.q} className="p-5">
                    <p className="mb-1.5 text-sm font-semibold text-sd-text">{faq.q}</p>
                    <p className="text-sm leading-relaxed text-sd-text2">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting">
              <div className="mb-8">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-sd-text3">Troubleshooting</p>
                <h2 className="font-display text-2xl text-sd-text">Common Issues</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: "Backend fails to start — config key missing", a: "Run node scripts/generate_secrets.js from the backend folder. The script creates the app_config collection and inserts the three required keys." },
                  { q: "OAuth callback returns 400 invalid_request (Docker)", a: "The BACKEND_URL environment variable must match the URL registered in Google Cloud Console. Update BACKEND_URL in docker-compose.yml and add the new callback URL to authorized redirect URIs." },
                  { q: "Files don't appear after uploading directly in Drive", a: "Click the Sync button in the Files page to pull in new files." },
                  { q: "Upload fails with 503", a: "All connected accounts are full. Go to Settings, click \"Connect another account\", and authorize a new Google account." },
                  { q: "CORS error in the browser", a: "Ensure both servers are running — backend on :8000, frontend on :3000. The Next.js dev proxy handles /api/* rewrites automatically." },
                ].map(item => (
                  <div key={item.q} className="rounded-2xl border border-sd-border bg-sd-s1 p-5">
                    <p className="mb-1.5 flex items-start gap-2 text-sm font-semibold text-sd-text">
                      <span className="mt-0.5 flex-shrink-0 text-amber-400">!</span>
                      {item.q}
                    </p>
                    <p className="pl-5 text-sm leading-relaxed text-sd-text2">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section>
              <div className="rounded-2xl border border-sd-accent/20 bg-sd-accent/5 p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-sd-accent/40 to-transparent" />
                <h2 className="font-display text-2xl text-sd-text">Ready?</h2>
                <p className="mt-2 text-sd-text2">Open the dashboard and start managing your storage pool.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link href="/login" className="btn-primary rounded-xl px-6 py-3 font-semibold">Open Dashboard</Link>
                  <Link href="/" className="rounded-xl border border-sd-border bg-sd-s1 px-6 py-3 font-semibold text-sd-text hover:border-sd-accent/30 transition">Back to Home</Link>
                </div>
              </div>
              <p className="mt-8 text-center text-xs text-sd-text3">
                StitchDrive is free and open source.{" "}
                <a href="https://github.com/Atifhasan250/Stitch-Drive" target="_blank" rel="noopener noreferrer" className="text-sd-accent hover:underline">View on GitHub.</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
