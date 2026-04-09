import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Tab = 'overview' | 'members' | 'admins' | 'organisations' | 'troubleshooting'

// ── Tiny primitives ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs font-black uppercase tracking-super text-primary/60 mb-4">
      {children}
    </p>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-3xl font-bold tracking-tighter text-white mb-8">
      {children}
    </h2>
  )
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}

function FeatureCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-low rounded-2xl p-5 transition-colors">
      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <h4 className="text-sm font-bold text-white mb-1.5">{title}</h4>
      <div className="text-sm text-slate-400 leading-relaxed space-y-1">{children}</div>
    </div>
  )
}

function StepFlow({ steps }: { steps: { icon: string; title: string; detail: string }[] }) {
  return (
    <div className="space-y-0">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4">
          {/* Left: number + connector */}
          <div className="flex flex-col items-center">
            <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/30 shrink-0 z-10">
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 bg-gradient-to-b from-primary/40 to-primary/10 my-1 min-h-[2rem]" />
            )}
          </div>
          {/* Right: content */}
          <div className={`pb-5 ${i === steps.length - 1 ? '' : ''}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="material-symbols-outlined text-primary text-lg">{s.icon}</span>
              <span className="text-sm font-bold text-white">{s.title}</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function IssueCard({
  icon, iconColor, problem, resolution, type = 'warning',
}: {
  icon: string; iconColor: string; problem: string; resolution: string; type?: 'warning' | 'info' | 'success'
}) {
  const palette = {
    warning: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    info:    { bg: 'bg-blue-500/8',  border: 'border-blue-500/20',  pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    success: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  }[type]

  return (
    <div className={`rounded-2xl border p-4 ${palette.bg} ${palette.border}`}>
      <div className="flex items-start gap-3">
        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 border ${palette.pill}`}>
          <span className="material-symbols-outlined text-lg" style={{ color: iconColor }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white mb-1">{problem}</p>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary">arrow_forward</span>
            <p className="text-sm text-slate-400">{resolution}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-low rounded-2xl p-5 flex gap-3">
      <div className="size-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
        <span className="material-symbols-outlined text-lg">lightbulb</span>
      </div>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  )
}

function RoleCard({
  icon, role, badge, description, permissions,
}: { icon: string; role: string; badge: string; description: string; permissions: string[] }) {
  return (
    <div className="bg-surface-low rounded-2xl p-5 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className="text-2xs font-black uppercase tracking-spaced text-primary/70 bg-primary/10 px-2.5 py-1 rounded-full">
          {badge}
        </span>
      </div>
      <h4 className="text-sm font-bold text-white mb-1">{role}</h4>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{description}</p>
      <ul className="space-y-1">
        {permissions.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="material-symbols-outlined text-emerald-400 text-sm">check_small</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CsvColumnRow({ field, required, accepted, example }: { field: string; required: boolean; accepted: string; example: string }) {
  return (
    <tr className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] transition-colors">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white font-mono">{field}</span>
          {required && (
            <span className="text-2xs font-black uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">Required</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-xs text-slate-400 leading-relaxed">{accepted}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <code className="text-xs text-primary/80 bg-primary/10 px-2 py-0.5 rounded font-mono">{example}</code>
      </td>
    </tr>
  )
}

function AccordionItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-2xl overflow-hidden transition-colors border ${open ? 'border-white/[0.08] bg-surface-low' : 'border-white/[0.04] bg-white/[0.02]'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="text-sm font-bold text-white">{question}</span>
        <span className={`material-symbols-outlined text-primary transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed pt-4">
          {answer}
        </div>
      )}
    </div>
  )
}

// ── Tab content ───────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-12">
      {/* Welcome */}
      <div>
        <SectionLabel>Welcome</SectionLabel>
        <SectionTitle>What is Rollcally?</SectionTitle>
        <p className="text-base text-slate-400 leading-relaxed mb-6 max-w-xl">
          Rollcally is a digital attendance system for groups like choirs, churches, and teams. No paper. No confusion. Just instant, verified check-ins.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: 'qr_code_scanner', label: 'Scan a QR code' },
            { icon: 'person_check', label: 'Tap your name' },
            { icon: 'check_circle', label: 'Checked in instantly' },
          ].map(({ icon, label }) => (
            <div key={icon} className="flex flex-col items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-center">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">{icon}</span>
              <span className="text-xs font-semibold text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick start - Members */}
      <div>
        <SectionLabel>Quick Start — Members</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-6">No account needed</h3>
        <StepFlow steps={[
          { icon: 'qr_code_scanner', title: 'Scan QR code', detail: 'Use your phone camera and tap the link that appears.' },
          { icon: 'search', title: 'Find your name', detail: 'Type at least 3 letters of your name to find yourself.' },
          { icon: 'touch_app', title: 'Confirm', detail: 'Tap your name, then confirm on the next screen.' },
          { icon: 'celebration', title: 'Done!', detail: 'You\'re checked in. Your admin sees it instantly.' },
        ]} />
      </div>

      {/* Quick start - Admins */}
      <div>
        <SectionLabel>Quick Start — Admins</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-6">Your dashboard in 3 steps</h3>
        <StepFlow steps={[
          { icon: 'person_add', title: 'Sign up via Admin Portal', detail: 'Create an account from the landing page.' },
          { icon: 'dashboard', title: 'Set up your organisation', detail: 'Create an organisation, then add a unit (your specific group).' },
          { icon: 'qr_code_2', title: 'Run your first event', detail: 'Create an event, generate the QR code, and share it with your members.' },
        ]} />
        <TipBox>
          Once your first event is live, members can check in with no app download or account — just a camera.
        </TipBox>
      </div>
    </div>
  )
}

function MembersTab() {
  return (
    <div className="space-y-12">
      <div>
        <SectionLabel>Check-In Flow</SectionLabel>
        <SectionTitle>How to Check In</SectionTitle>
        <StepFlow steps={[
          { icon: 'qr_code_scanner', title: 'Scan QR Code', detail: 'Open your phone camera and point it at the code posted at your venue. Tap the link.' },
          { icon: 'search', title: 'Find Your Name', detail: 'Type at least 3 characters of your name (first or last). Results appear instantly.' },
          { icon: 'touch_app', title: 'Confirm', detail: 'Tap your name in the list. Review the confirmation screen and tap "Yes, check me in".' },
          { icon: 'celebration', title: 'Done!', detail: 'Green success screen — you\'re recorded. Your leader can see you checked in right now.' },
        ]} />
      </div>

      <div>
        <SectionLabel>Return Visits</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Faster Every Time</h3>
        <div className="bg-surface-low rounded-2xl p-5 space-y-3">
          {[
            { icon: 'memory', text: 'Your name is remembered on this device after your first check-in' },
            { icon: 'bolt', text: 'On your next visit, just confirm — no searching needed' },
            { icon: 'smartphone', text: 'Works only on the same phone or browser you used before' },
          ].map(({ icon, text }) => (
            <div key={icon} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-lg shrink-0">{icon}</span>
              <span className="text-sm text-slate-300">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Issues</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">If Something Goes Wrong</h3>
        <div className="space-y-3">
          <IssueCard icon="check_circle" iconColor="#10b981" problem="Already checked in" resolution="You're already recorded for this event. Nothing to do." type="success" />
          <IssueCard icon="location_off" iconColor="#f59e0b" problem="Too far away" resolution="Enable location access and make sure you're physically at the venue." type="warning" />
          <IssueCard icon="devices" iconColor="#f59e0b" problem="Already Registered — device in use" resolution="Someone else already checked in using this device for this session. Each device can only be used for one person per event. Speak to your group leader if this is a mistake." type="warning" />
          <IssueCard icon="sync_problem" iconColor="#ef4444" problem="Sync Denied" resolution="Tap 'Re-verify Identity' to return to the member list and try again." type="warning" />
          <IssueCard icon="person_search" iconColor="#6366f1" problem="Name not found" resolution="Check your spelling or try your surname. Ask your admin to verify you're on the roster." type="info" />
        </div>
      </div>
    </div>
  )
}

function AdminsTab() {
  return (
    <div className="space-y-12">
      <div>
        <SectionLabel>Dashboard</SectionLabel>
        <SectionTitle>Your Admin Centre</SectionTitle>
        <CardGrid>
          <FeatureCard icon="event" title="Create Event">
            <p>Tap <strong className="text-white">Create Event</strong></p>
            <p>→ Pick date + type</p>
            <p>→ Tap Create</p>
            <p className="text-2xs text-slate-500 mt-2">Two types: Regular Meeting or Main Event</p>
          </FeatureCard>
          <FeatureCard icon="qr_code_2" title="QR Code">
            <p>Each event has a <strong className="text-white">unique code</strong></p>
            <p>→ Download as PNG</p>
            <p>→ Print or share before the event</p>
          </FeatureCard>
          <FeatureCard icon="monitoring" title="Live Attendance">
            <p>Dashboard updates <strong className="text-white">automatically</strong></p>
            <p>→ Total / Present / Absent</p>
            <p>→ Attendance rate %</p>
            <p>→ Toggle members manually</p>
          </FeatureCard>
          <FeatureCard icon="file_export" title="Export Absentees">
            <p>Switch to the <strong className="text-white">Absent</strong> tab</p>
            <p>→ TXT — plain text table</p>
            <p>→ CSV — Excel compatible</p>
            <p>→ RTF — Word document</p>
          </FeatureCard>
        </CardGrid>
      </div>

      <div>
        <SectionLabel>Roster</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Managing Members</h3>
        <div className="bg-surface-low overflow-hidden rounded-2xl flex flex-col gap-1 p-1">
          {[
            { action: 'Add', icon: 'person_add', detail: 'Enter name, section, phone, birthday', color: 'text-emerald-400' },
            { action: 'Edit', icon: 'edit', detail: 'Update any detail at any time', color: 'text-blue-400' },
            { action: 'Deactivate', icon: 'person_off', detail: 'Hides from roster, preserves history', color: 'text-amber-400' },
            { action: 'Delete', icon: 'delete', detail: 'Permanent — removes all history', color: 'text-red-400' },
          ].map(({ action, icon, detail, color }) => (
            <div key={action} className="flex items-center gap-4 px-5 py-4 rounded-xl hover:bg-white/[0.04] transition-colors">
              <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
              <div className="flex-1">
                <span className="text-sm font-bold text-white">{action}</span>
                <span className="text-xs text-slate-500 ml-3">{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Bulk Import</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Roster Import</h3>
        <StepFlow steps={[
          { icon: 'table', title: 'Prepare your spreadsheet', detail: 'Open your roster in Excel, Google Sheets, or Numbers. Make sure the first row is a header row with column names.' },
          { icon: 'upload_file', title: 'Upload directly', detail: 'Upload your Excel file (.xlsx) or CSV (.csv) directly — no conversion needed. Column order does not matter; Rollcally reads headers by name.' },
          { icon: 'preview', title: 'Review the preview', detail: 'Rollcally highlights exact and near-duplicate names in the preview before anything is saved.' },
          { icon: 'check_circle', title: 'Confirm import', detail: 'Exact duplicates are automatically skipped. New members are added in one go.' },
        ]} />

        {/* Column reference table */}
        <div className="mt-6 rounded-2xl bg-surface-low overflow-hidden">
          <div className="bg-surface-high px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">table_chart</span>
            <span className="text-sm font-bold text-white">Recognised Column Names</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-highest text-2xs font-black uppercase tracking-wider text-slate-500 border-b border-white/[0.06]">
                  <th className="px-4 py-2.5">Column / Field</th>
                  <th className="px-4 py-2.5">Accepted header names</th>
                  <th className="px-4 py-2.5">Example value</th>
                </tr>
              </thead>
              <tbody>
                <CsvColumnRow
                  field="Name"
                  required
                  accepted={"name · full name · fullname · member · member name — any of these will be detected as the name column"}
                  example="John Doe"
                />
                <CsvColumnRow
                  field="Phone"
                  required={false}
                  accepted={"phone · phone number · mobile · tel · telephone · contact"}
                  example="+2348001234567"
                />
                <CsvColumnRow
                  field="Section"
                  required={false}
                  accepted={"section · group · voice · voice part · department · part"}
                  example="Soprano"
                />
                <CsvColumnRow
                  field="Status"
                  required={false}
                  accepted={"status · state — value must be 'active' or 'inactive'. Anything else defaults to 'active'"}
                  example="active"
                />
                <CsvColumnRow
                  field="Birthday"
                  required={false}
                  accepted={"birthday · dob · date of birth · birth date"}
                  example="14/05/1990"
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Date formats */}
        <div className="mt-4 rounded-2xl bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-400 text-lg">calendar_month</span>
            <span className="text-sm font-bold text-white">Birthday Date Formats</span>
          </div>
          <div className="space-y-2">
            {[
              { fmt: 'DD/MM', ex: '18/11', ok: true },
              { fmt: 'DD/MM/YYYY', ex: '18/11/1990', ok: true },
              { fmt: 'YYYY-MM-DD', ex: '1990-11-18', ok: true },
              { fmt: 'MM/DD/YYYY', ex: '11/18/1990', ok: true },
              { fmt: 'DD-MM-YY', ex: '18-11-90', ok: false },
              { fmt: 'Month name', ex: 'Nov 18 1990', ok: false },
            ].map(({ fmt, ex, ok }) => (
              <div key={fmt} className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-base ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ok ? 'check_circle' : 'cancel'}
                </span>
                <code className="text-xs font-mono text-slate-300 w-32">{fmt}</code>
                <code className="text-xs font-mono text-slate-500">{ex}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Common pitfalls */}
        <div className="mt-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-super text-primary/60">
            Common mistakes to avoid
          </p>
          <IssueCard
            icon="table_rows"
            iconColor="#f59e0b"
            problem="No header row in the CSV"
            resolution="Rollcally needs a header row (e.g. 'Name, Phone, Section') to map columns. Without it, the first data row is treated as headers and will be skipped or misread."
            type="warning"
          />
          <IssueCard
            icon="text_format"
            iconColor="#f59e0b"
            problem="Unrecognised column name for the member name"
            resolution="If your name column is labelled something like 'Full Member Name' or 'Chorister', rename it to just 'Name' or 'Full Name' before exporting."
            type="warning"
          />
          <IssueCard
            icon="calendar_month"
            iconColor="#f59e0b"
            problem="Birthday shows as a number in Excel (e.g. 45123)"
            resolution="This happens when Excel stores the date as a serial number. Rollcally handles this automatically when you upload the .xlsx file directly — no manual fix needed. If uploading CSV, format the birthday column as text (DD/MM or DD/MM/YYYY) before exporting."
            type="warning"
          />
        </div>

        <TipBox>
          <strong className="text-white block mb-1">Download the built-in template.</strong>
          Inside the Import CSV modal, tap <strong className="text-white">Download Template</strong>. It gives you a correctly-formatted CSV with example rows you can replace with your real data.
        </TipBox>
      </div>

      <div>
        <SectionLabel>Location Enforcement</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Require Members to Be On-Site</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          When enabled for an event, members must be physically within a set radius of your venue to check in. Their device will be rejected if they are too far away.
        </p>
        <StepFlow steps={[
          { icon: 'settings', title: 'Set venue coordinates', detail: 'Open your unit dashboard → tap the settings icon → scroll to Venue Location. Enter your address and tap Find, or type the coordinates manually. Set the check-in radius (default 100 m).' },
          { icon: 'location_on', title: 'Enable per event', detail: 'Inside an event, tap the location toggle. It turns blue when active. A warning appears if your unit has no coordinates set yet.' },
          { icon: 'check_circle', title: 'Members check in on-site', detail: 'Members are silently geolocated during check-in. If they are within range, check-in proceeds normally. If they are too far, they see a "Too far away" message.' },
        ]} />
        <TipBox>
          The radius is measured in metres. 100 m works well for most indoor venues. Increase to 200–500 m if your building has thick walls or poor GPS reception.
        </TipBox>
      </div>

      <div>
        <SectionLabel>Absence Notifications</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">SMS & Email Reports</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-5">
          After an event, you can send an SMS to every absent member who has given consent, and receive an email summary in your inbox.
        </p>
        <CardGrid>
          <FeatureCard icon="sms" title="SMS to Absentees">
            <p>Open an event → scroll to <strong className="text-white">Absence Messaging</strong></p>
            <p>→ Enable messaging for the unit in settings</p>
            <p>→ Tap <strong className="text-white">Send to all absentees</strong></p>
            <p className="text-2xs text-slate-500 mt-2">Only members with SMS consent and a phone number are contacted. A cooldown window prevents repeat messages.</p>
          </FeatureCard>
          <FeatureCard icon="mail" title="Email Report to You">
            <p>After sending SMS, you automatically receive an email listing every absent member and whether their SMS was delivered.</p>
            <p className="text-2xs text-slate-500 mt-2">Sent to the unit owner's email address. Requires RESEND_API_KEY to be configured by your platform administrator.</p>
          </FeatureCard>
          <FeatureCard icon="tune" title="Messaging Settings">
            <p>Inside the event → <strong className="text-white">Absence Messaging</strong> → <strong className="text-white">Configure</strong></p>
            <p>→ Enable / disable for the unit</p>
            <p>→ Set auto-send hour and timezone</p>
            <p>→ Set cooldown period (days between messages)</p>
            <p className="text-white font-semibold mt-2">Personalising the SMS template</p>
            <p>
              Your message template can include two special placeholders that Rollcally
              replaces automatically before each SMS is sent:
            </p>
            <ul className="mt-1 space-y-1 pl-1">
              <li>
                <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-2xs">{'{{name}}'}</code>
                <span className="ml-1.5">→ replaced with the member's full name</span>
              </li>
              <li>
                <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-2xs">{'{{event}}'}</code>
                <span className="ml-1.5">→ replaced with the event type (e.g. Sunday Service)</span>
              </li>
            </ul>
            <p className="text-2xs text-slate-500 mt-2">
              <strong className="text-slate-300">Important:</strong> leave{' '}
              <code className="text-amber-400/80 bg-amber-500/10 px-1 rounded font-mono">{'{{name}}'}</code>{' '}
              and{' '}
              <code className="text-amber-400/80 bg-amber-500/10 px-1 rounded font-mono">{'{{event}}'}</code>{' '}
              exactly as shown — do not replace them with real text. Rollcally fills
              them in for each member automatically.
            </p>
            <p className="text-2xs text-slate-500 mt-1">
              Example: <em>"Hi {'{{name}}'}, we missed you at {'{{event}}'} today. Hope you're well."</em>{' '}
              becomes <em>"Hi Grace Adeyemi, we missed you at Sunday Service today. Hope you're well."</em>
            </p>
          </FeatureCard>
          <FeatureCard icon="credit_card" title="SMS Credits">
            <p>Each SMS sent costs one credit from your plan balance.</p>
            <p>→ View balance on the <strong className="text-white">Billing</strong> page</p>
            <p>→ Credits reset monthly with your subscription</p>
            <p className="text-2xs text-slate-500 mt-2">Blocked sends are logged but not charged.</p>
          </FeatureCard>
        </CardGrid>
      </div>

      <div>
        <SectionLabel>Analytics</SectionLabel>
        <CardGrid>
          <FeatureCard icon="person_check" title="Member Profile">
            <p>Attendance rate %</p>
            <p>Current streak</p>
            <p>Last-10 activity chart</p>
            <p>Full history log</p>
          </FeatureCard>
          <FeatureCard icon="cake" title="Birthday Notifications">
            <p>Bell icon at top of screen</p>
            <p>Alerts day before + on the day</p>
            <p>Dismiss individually</p>
          </FeatureCard>
        </CardGrid>
      </div>
    </div>
  )
}

function OrgsTab() {
  return (
    <div className="space-y-12">
      <div>
        <SectionLabel>Setup</SectionLabel>
        <SectionTitle>Organisations & Units</SectionTitle>
        <CardGrid>
          <FeatureCard icon="apartment" title="Create Organisation">
            <p>From your dashboard, tap <strong className="text-white">New</strong></p>
            <p>→ Enter a name</p>
            <p>→ Tap Create</p>
            <p className="text-2xs text-slate-500 mt-2">You become the owner automatically</p>
          </FeatureCard>
          <FeatureCard icon="groups" title="Create Units">
            <p>Inside your org, tap <strong className="text-white">Create New Unit</strong></p>
            <p>→ Add name + description</p>
            <p>→ You become unit admin</p>
          </FeatureCard>
          <FeatureCard icon="explore" title="Join Organisation">
            <p>Go to <strong className="text-white">Discover</strong></p>
            <p>→ Search by name</p>
            <p>→ Request Access</p>
            <p>→ Wait for owner approval</p>
          </FeatureCard>
          <FeatureCard icon="how_to_reg" title="Approve Requests">
            <p>Go to <strong className="text-white">Requests</strong> tab in your org</p>
            <p>→ See requester email</p>
            <p>→ Approve or reject</p>
          </FeatureCard>
        </CardGrid>
      </div>

      <div>
        <SectionLabel>Roles</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-6">Who Can Do What</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <RoleCard
            icon="person"
            role="Member"
            badge="Public"
            description="No account needed. Checks in via QR code only."
            permissions={['Scan QR code', 'Check themselves in']}
          />
          <RoleCard
            icon="manage_accounts"
            role="Unit Admin"
            badge="Admin"
            description="Directly assigned to a unit. Manages that unit's events and roster."
            permissions={['Manage unit members', 'Create events', 'Track attendance', 'Export reports']}
          />
          <RoleCard
            icon="group_add"
            role="Org Member"
            badge="Member"
            description="Joined an organisation. Can create their own units."
            permissions={['Create new units', 'View org dashboard', 'Become admin of own units']}
          />
          <RoleCard
            icon="shield"
            role="Org Owner"
            badge="Owner"
            description="Created the organisation. Full control over everything inside."
            permissions={['All unit CRUD', 'Approve join requests', 'View all unit dashboards', 'Manage org settings']}
          />
          <RoleCard
            icon="admin_panel_settings"
            role="Super Admin"
            badge="Platform"
            description="Global platform administrator. Set up by the system operator."
            permissions={['Access all organisations', 'Add unit admins by email', 'Full platform visibility']}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Settings</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Manage Your Organisation</h3>
        <div className="space-y-2">
          {[
            { icon: 'edit', label: 'Rename organisation', detail: 'Tap settings on the org page' },
            { icon: 'delete_forever', label: 'Delete organisation', detail: 'Permanent — removes all units and history' },
            { icon: 'tune', label: 'Edit unit', detail: 'Rename, update description, or set venue coordinates for location enforcement' },
            { icon: 'location_on', label: 'Set venue location', detail: 'Enter an address or coordinates in Unit Settings — required for location-enforced events' },
            { icon: 'remove_circle', label: 'Delete unit', detail: 'Removes all members and attendance history' },
          ].map(({ icon, label, detail }) => (
            <div key={icon} className="flex items-center gap-4 p-4 bg-surface-low rounded-xl hover:bg-surface-high transition-colors">
              <span className="material-symbols-outlined text-slate-500 text-lg">{icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-xs text-slate-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TroubleshootingTab() {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: 'QR code not working',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Adjust distance — try closer or further away</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Improve lighting in the room</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Ask your admin for the direct link</li>
        </ul>
      ),
    },
    {
      q: 'My name is not in the list',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Check your spelling — try surname first</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Type at least 3 characters before results appear</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Contact your group leader — you may not be on the roster yet</li>
        </ul>
      ),
    },
    {
      q: 'I see "Already checked in"',
      a: <p>This is not an error. Your attendance has already been recorded for this event. No action is needed.</p>,
    },
    {
      q: 'I see "Too far away"',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Make sure you're physically at the venue</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Allow location access when the browser asks</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> If inside and still blocked, ask your admin to mark you manually</li>
        </ul>
      ),
    },
    {
      q: 'I see "Already Registered"',
      a: <p>Someone else already checked in using this device for this session. Each physical device can only be used for one person per event. If this is a mistake, speak to your group leader — they can mark your attendance manually from the admin dashboard.</p>,
    },
    {
      q: 'My organisation is not showing on my dashboard',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Switch to another browser tab and come back — the dashboard refreshes on return</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> If your join request was just approved, log out and back in</li>
        </ul>
      ),
    },
    {
      q: 'I forgot my admin password',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> On the login page, tap <strong className="text-white">Forgot password?</strong></li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Enter your email and follow the reset link in your inbox</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Check your spam folder if no email arrives within a few minutes</li>
        </ul>
      ),
    },
    {
      q: 'Admin page is not loading',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Check your internet connection</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Tap the <strong className="text-white">Try again</strong> button on the error screen</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Log out and back in if the issue persists</li>
        </ul>
      ),
    },
    {
      q: 'Check-in page not working offline',
      a: <p>Offline check-in only works if you've visited the check-in page <strong className="text-white">and searched for names</strong> on the same device while online before. If it's your first time or you're on a new device, a network connection is required.</p>,
    },
    {
      q: 'Roster import — "Import failed"',
      a: (
        <div className="space-y-3">
          <p>This generic error usually means one of these issues:</p>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">Invalid date format</strong> — Birthday accepts DD/MM, DD/MM/YYYY, YYYY-MM-DD, or MM/DD/YYYY. Dates like "14 May 1990" or "May-90" are not supported. Fix the column in your spreadsheet and re-upload.</span></li>
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">Permission denied</strong> — You must be the unit creator, org owner, or an explicitly assigned unit admin to import members. Contact your org owner to grant you access.</span></li>
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">Network error</strong> — Check your internet connection and try again. If importing a large roster, a brief connection drop will fail the whole batch.</span></li>
          </ul>
        </div>
      ),
    },
    {
      q: 'Roster import — "No valid rows found"',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Every row in your file has an empty name column — check that the name column is correctly identified</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> The file may have been saved with only headers and no data rows</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> If your name column is headed something unusual (e.g. "Full Member"), rename it to <strong className="text-white">Name</strong> or <strong className="text-white">Full Name</strong></li>
        </ul>
      ),
    },
    {
      q: 'Roster import — member names appear in the wrong columns in the preview',
      a: (
        <div className="space-y-3">
          <p>This means Rollcally could not detect which column contains the names. It happens when:</p>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> Your header row uses a non-standard label (e.g. "Member ID", "Chorister Name", "Full Member Name")</li>
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> There is no header row at all — data starts on row 1</li>
          </ul>
          <p><strong className="text-white">Fix:</strong> Rename the column header to <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">Name</code> or <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">Full Name</code> and re-export. Or download and use the built-in template.</p>
        </div>
      ),
    },
    {
      q: 'Roster import — all rows flagged as duplicates',
      a: (
        <ul className="space-y-2">
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> <strong className="text-white">Exact duplicate:</strong> A member with that exact name already exists in this unit. These rows are automatically skipped — this is intentional.</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> <strong className="text-white">Fuzzy (similar) duplicate:</strong> The name is very close to an existing member (e.g. "John" vs "Johnny"). Review these rows carefully — they will still be imported unless you cancel.</li>
          <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span> If your unit's roster was already imported and you're re-importing the same file, all rows will be duplicates. No action is needed.</li>
        </ul>
      ),
    },
    {
      q: '"Failed to save" when adding a member manually',
      a: (
        <div className="space-y-3">
          <p>The error message shown now includes the actual reason. Common causes:</p>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">new row violates row-level security policy</strong> — You don't have write permission on this unit. Only the unit creator, org owner, and explicitly assigned unit admins can add members. Ask your org owner to grant you unit admin access.</span></li>
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">Network error</strong> — Check your internet connection and try again.</span></li>
            <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_right</span><span><strong className="text-white">JWT expired</strong> — Your session has timed out. Log out and log back in, then try again.</span></li>
          </ul>
        </div>
      ),
    },
    {
      q: '"Failed to save" when adding a member — I am the org owner',
      a: (
        <div className="space-y-3">
          <p>If you created the organisation and are still seeing this error, a database migration may need to be applied. Ask your system administrator to run the following in the Supabase SQL Editor:</p>
          <div className="bg-surface-highest rounded-xl p-3 mt-2">
            <code className="text-xs font-mono text-primary/80 leading-relaxed whitespace-pre-wrap">{`drop policy if exists "Managers: full access to members" on members;

create policy "Managers: full access to members"
  on members for all
  using (is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id))
  with check(is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id));`}</code>
          </div>
          <p>This updates the database permission rule to include all authorised roles.</p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-12">
      <div>
        <SectionLabel>Common Issues</SectionLabel>
        <SectionTitle>Troubleshooting Guide</SectionTitle>
        <div className="space-y-3">
          {items.map(({ q, a }) => (
            <AccordionItem key={q} question={q} answer={a} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Best Practices</SectionLabel>
        <h3 className="font-display text-xl font-bold text-white mb-4">Tips to Avoid Issues</h3>
        <div className="space-y-3">
          <TipBox>
            <strong className="text-white block mb-1">Print QR codes ahead of time.</strong>
            Displaying a printed QR code on a stand is the fastest check-in method — members don't wait for a screen.
          </TipBox>
          <TipBox>
            <strong className="text-white block mb-1">Create events before members arrive.</strong>
            The QR code is specific to each event. Create it a few minutes before people walk in.
          </TipBox>
          <TipBox>
            <strong className="text-white block mb-1">Use Inactive instead of Delete.</strong>
            Inactive members are hidden from the roster but their attendance history is preserved.
          </TipBox>
          <TipBox>
            <strong className="text-white block mb-1">Keep section names consistent.</strong>
            Section names are free-text. Use the same spelling (e.g., "Soprano" not "soprano") for grouped exports to work correctly.
          </TipBox>
        </div>
      </div>

      {/* Need help CTA */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 text-center">
        <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">support_agent</span>
        </div>
        <h3 className="font-display text-xl font-bold text-white mb-2">Still need help?</h3>
        <p className="text-sm text-slate-400 mb-6">Contact your organisation admin or reach us via the Rollcally website.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <div className="flex items-center gap-2 bg-surface-low rounded-xl px-4 py-2.5">
            <span className="material-symbols-outlined text-primary text-lg">admin_panel_settings</span>
            <span className="text-sm font-bold text-white">Contact your admin</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-low rounded-xl px-4 py-2.5">
            <span className="material-symbols-outlined text-primary text-lg">language</span>
            <span className="text-sm font-bold text-white">rollcally.com</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',        label: 'Overview',        icon: 'home'              },
  { id: 'members',         label: 'Members',          icon: 'person'            },
  { id: 'admins',          label: 'Admins',           icon: 'manage_accounts'   },
  { id: 'organisations',   label: 'Organisations',    icon: 'apartment'         },
  { id: 'troubleshooting', label: 'Troubleshooting',  icon: 'help_outline'      },
]

export default function HelpCentre() {
  const navigate = useNavigate()
  const [active, setActive] = useState<Tab>('overview')

  return (
    <div className="bg-background-dark text-slate-100 min-h-screen flex flex-col antialiased">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background-dark/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="size-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-primary/20 transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-bold tracking-tight text-white">Help Centre</h1>
            <p className="text-2xs text-slate-500 uppercase tracking-spaced font-bold">Rollcally</p>
          </div>
          <img src="/logo.png" alt="Rollcally" className="h-8 w-8 object-contain shrink-0" />
        </div>

        {/* Tab bar */}
        <div className="max-w-3xl mx-auto px-4 pb-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border-b-2 ${
                  active === t.id
                    ? 'text-primary border-primary'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      {active === 'overview' && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto px-6 py-12 relative">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Rollcally" className="h-12 w-12 object-contain" />
              <p className="text-2xs font-black uppercase tracking-super text-primary/60">
                Rollcally Help Centre
              </p>
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tighter text-white mb-4">
              How can we help?
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
              Everything you need to use Rollcally — whether you're scanning in at an event or running your organisation.
            </p>
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 pb-24">
        {active === 'overview'        && <OverviewTab />}
        {active === 'members'         && <MembersTab />}
        {active === 'admins'          && <AdminsTab />}
        {active === 'organisations'   && <OrgsTab />}
        {active === 'troubleshooting' && <TroubleshootingTab />}
      </main>

      {/* ── Quick-switch footer ─────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-40 bg-background-dark/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              const idx = TABS.findIndex(t => t.id === active)
              if (idx > 0) setActive(TABS[idx - 1].id)
            }}
            disabled={active === 'overview'}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary transition-colors disabled:opacity-0"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Prev
          </button>
          <div className="flex gap-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`size-2 rounded-full transition-all ${active === t.id ? 'bg-primary scale-125' : 'bg-slate-700 hover:bg-slate-500'}`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              const idx = TABS.findIndex(t => t.id === active)
              if (idx < TABS.length - 1) setActive(TABS[idx + 1].id)
            }}
            disabled={active === 'troubleshooting'}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary transition-colors disabled:opacity-0"
          >
            Next
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}
