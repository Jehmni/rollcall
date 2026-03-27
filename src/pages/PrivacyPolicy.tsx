import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = 'March 26, 2026'
const COMPANY = 'Rollcally Inc.'
const EMAIL = 'privacy@rollcally.com'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-black uppercase tracking-wider text-white mb-4">{title}</h2>
      <div className="space-y-3 text-slate-300 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary mt-0.5 flex-shrink-0">—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-300">{value}</span>
    </div>
  )
}

const TOC = [
  { id: 'overview', label: '1. Overview' },
  { id: 'controller', label: '2. Data Controller' },
  { id: 'data-collected', label: '3. Data We Collect' },
  { id: 'how-we-use', label: '4. How We Use Your Data' },
  { id: 'legal-basis', label: '5. Legal Basis (GDPR)' },
  { id: 'retention', label: '6. Data Retention' },
  { id: 'sharing', label: '7. Data Sharing' },
  { id: 'international', label: '8. International Transfers' },
  { id: 'cookies', label: '9. Cookies & Local Storage' },
  { id: 'security', label: '10. Security' },
  { id: 'your-rights', label: '11. Your Rights' },
  { id: 'california', label: '12. California Residents (CCPA)' },
  { id: 'children', label: '13. Children\'s Privacy' },
  { id: 'changes', label: '14. Changes to This Policy' },
  { id: 'contact', label: '15. Contact Us' },
]

export default function PrivacyPolicy() {
  return (
    <div className="bg-background-dark font-display text-white min-h-screen antialiased selection:bg-primary/30">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Rollcally — go to homepage">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain transition-transform group-hover:scale-110" aria-hidden="true" />
            <span className="text-white text-xl font-black tracking-tight">Rollcally</span>
          </Link>
          <Link
            to="/terms"
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-primary transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 lg:py-20">

        {/* Hero */}
        <div className="mb-14 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 mb-6">
            <span className="material-symbols-outlined text-primary text-sm">shield</span>
            <span className="text-2xs font-black uppercase tracking-widest text-primary">Legal</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-400 text-base font-medium">
            Effective date: <span className="text-slate-300">{EFFECTIVE_DATE}</span>
          </p>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl leading-relaxed">
            Your privacy matters to us. This policy explains what personal information we collect, how we use
            it, who we share it with, and the rights you have over your data.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">

          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              <p className="text-2xs font-black uppercase tracking-widest text-slate-500 mb-3">Contents</p>
              {TOC.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-xs text-slate-500 hover:text-primary transition-colors py-1 font-medium"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Body */}
          <div className="space-y-12">

            <Section id="overview" title="1. Overview">
              <P>
                {COMPANY} ("Rollcally", "we", "us", "our") operates the Rollcally platform, a QR-based
                attendance management service. This Privacy Policy describes how we collect, use, disclose,
                and safeguard personal information when you use our web application and progressive web app
                (the "Service").
              </P>
              <P>
                This policy applies to administrators who create accounts and manage organisations, and to
                members whose attendance data is tracked through the Service. It also applies to visitors
                to our platform.
              </P>
            </Section>

            <Section id="controller" title="2. Data Controller">
              <P>
                {COMPANY} is the data controller for personal data collected directly from administrators
                (account holders). Administrators who upload member data to the Service act as data controllers
                for that member data; Rollcally acts as a data processor on their behalf.
              </P>
              <P>Contact our privacy team at: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></P>
            </Section>

            <Section id="data-collected" title="3. Data We Collect">
              <P>We collect the following categories of personal information:</P>

              <div className="bg-surface-low rounded-2xl p-5 space-y-0 mt-2">
                <TableRow label="Account data" value="Email address and hashed password for administrator accounts." />
                <TableRow label="Member data" value="Name, phone number, section/group, birthday (optional) — uploaded by administrators." />
                <TableRow label="Attendance data" value="Event attendance records, check-in timestamps." />
                <TableRow label="Push subscriptions" value="Browser push subscription endpoints for members who opt in to notifications." />
                <TableRow label="Usage data" value="Log data including IP address, browser type, pages visited, and timestamps, collected automatically when you access the Service." />
                <TableRow label="Session data" value="Session tokens stored in browser storage to keep you signed in." />
              </div>

              <P>
                We do not collect payment card information. We do not collect biometric data. We do not
                build advertising profiles or sell your data.
              </P>
            </Section>

            <Section id="how-we-use" title="4. How We Use Your Data">
              <P>We use your personal data to:</P>
              <Ul items={[
                'Create and manage your administrator account and authenticate you.',
                'Provide the attendance tracking, roster management, and notification features of the Service.',
                'Send push notifications to members who have consented (triggered by administrators).',
                'Maintain security, detect fraud, and prevent abuse.',
                'Diagnose technical issues and improve the reliability and performance of the Service.',
                'Comply with legal obligations and enforce our Terms of Service.',
                'Send transactional emails related to your account (e.g. password reset, email confirmation).',
              ]} />
              <P>We do not use your data for targeted advertising or sell it to third parties.</P>
            </Section>

            <Section id="legal-basis" title="5. Legal Basis for Processing (GDPR)">
              <P>
                If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland,
                our legal bases for processing personal data are:
              </P>
              <Ul items={[
                'Contract — processing necessary to provide the Service you have signed up for (administrator account data).',
                'Legitimate interests — improving and securing the Service, fraud prevention, and service analytics, where these interests are not overridden by your rights.',
                'Consent — for push notification subscriptions, which members may withdraw at any time.',
                'Legal obligation — where we are required to process data to comply with applicable law.',
              ]} />
              <P>
                For member data uploaded by administrators, the legal basis for Rollcally's processing is
                the administrator's instruction (data processor relationship). Administrators are responsible
                for identifying their own legal basis for collecting member data.
              </P>
            </Section>

            <Section id="retention" title="6. Data Retention">
              <P>
                We retain personal data for as long as necessary to provide the Service and comply with our
                legal obligations:
              </P>
              <Ul items={[
                'Administrator account data is retained for the duration of the account and deleted within 90 days of account termination upon request.',
                'Member and attendance data is retained while the associated administrator account is active. Administrators may delete individual records at any time.',
                'Push notification subscriptions are automatically removed when the browser signals that the subscription is no longer valid (HTTP 410/404), or upon member opt-out.',
                'Usage logs are retained for up to 90 days for security and debugging purposes.',
              ]} />
            </Section>

            <Section id="sharing" title="7. Data Sharing">
              <P>We do not sell your personal data. We share data only in the following circumstances:</P>
              <Ul items={[
                'Infrastructure providers: Supabase (database, authentication, and edge functions). Supabase processes data on our behalf under a data processing agreement.',
                'Legal requirements: We may disclose data if required by applicable law, court order, or governmental authority, or to protect the rights, property, or safety of Rollcally, its users, or the public.',
                'Business transfers: In the event of a merger, acquisition, or sale of assets, your data may be transferred. We will notify affected users prior to data being transferred to a new controller.',
              ]} />
            </Section>

            <Section id="international" title="8. International Data Transfers">
              <P>
                Rollcally uses Supabase, which may store and process data in the United States or other
                countries. Where data is transferred outside the EEA or UK, we ensure appropriate safeguards
                are in place, such as Standard Contractual Clauses approved by the European Commission or
                the UK equivalent, or other legally recognised transfer mechanisms.
              </P>
            </Section>

            <Section id="cookies" title="9. Cookies & Local Storage">
              <P>
                We use minimal browser storage to operate the Service:
              </P>
              <Ul items={[
                'Authentication tokens (localStorage / sessionStorage) — required to keep administrators signed in and to persist event context across page navigations.',
                'No third-party advertising or analytics cookies are set.',
                'No cross-site tracking occurs.',
              ]} />
              <P>
                We do not use cookies for marketing or profiling purposes. The storage we use is strictly
                necessary for the Service to function and is cleared when you sign out.
              </P>
            </Section>

            <Section id="security" title="10. Security">
              <P>
                We implement technical and organisational security measures designed to protect your personal
                data, including:
              </P>
              <Ul items={[
                'All data in transit is encrypted using TLS/HTTPS.',
                'Passwords are hashed and never stored in plain text.',
                'Database access is protected by Row-Level Security (RLS) policies ensuring users can only access data they are authorised to view.',
                'Administrator roles are enforced at the database level, not solely in application logic.',
                'Push notification VAPID keys are stored as encrypted secrets, not in application code.',
              ]} />
              <P>
                No method of transmission over the internet or electronic storage is 100% secure. While we
                strive to protect your data, we cannot guarantee absolute security. Please notify us
                immediately at {EMAIL} if you suspect a security breach involving your account.
              </P>
            </Section>

            <Section id="your-rights" title="11. Your Rights">
              <P>
                Depending on your location, you may have the following rights regarding your personal data:
              </P>
              <Ul items={[
                'Right of access — request a copy of the personal data we hold about you.',
                'Right to rectification — request correction of inaccurate or incomplete data.',
                'Right to erasure ("right to be forgotten") — request deletion of your personal data where there is no overriding legitimate purpose for its retention.',
                'Right to restriction — request that we restrict processing of your data in certain circumstances.',
                'Right to data portability — receive your data in a structured, machine-readable format.',
                'Right to object — object to processing based on legitimate interests.',
                'Right to withdraw consent — where processing is based on consent (e.g. push notifications), withdraw that consent at any time.',
                'Rights related to automated decision-making — we do not make decisions about you using solely automated means that produce legal or similarly significant effects.',
              ]} />
              <P>
                To exercise any of these rights, contact us at{' '}
                <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.
                We will respond within 30 days (or within the timeframe required by applicable law).
                We may need to verify your identity before processing your request.
              </P>
              <P>
                If you are in the EEA or UK, you have the right to lodge a complaint with your local
                data protection supervisory authority. In the UK, this is the Information Commissioner's
                Office (ICO) at{' '}
                <span className="text-slate-400">ico.org.uk</span>.
              </P>
            </Section>

            <Section id="california" title="12. California Residents (CCPA / CPRA)">
              <P>
                If you are a California resident, the California Consumer Privacy Act (CCPA), as amended
                by the California Privacy Rights Act (CPRA), grants you the following additional rights:
              </P>
              <Ul items={[
                'Right to know — the categories and specific pieces of personal information we collect, the purposes for collection, and the categories of third parties with whom we share it.',
                'Right to delete — request deletion of personal information we have collected, subject to certain exceptions.',
                'Right to correct — request correction of inaccurate personal information.',
                'Right to opt out of sale or sharing — we do not sell or share your personal information for cross-context behavioural advertising.',
                'Right to limit use of sensitive personal information — we do not use sensitive personal information for purposes other than those permitted by the CPRA.',
                'Right to non-discrimination — we will not discriminate against you for exercising your CCPA rights.',
              ]} />
              <P>
                To submit a CCPA request, contact us at {EMAIL} with the subject line "California Privacy Request".
                We will verify your identity before processing your request.
              </P>
            </Section>

            <Section id="children" title="13. Children's Privacy">
              <P>
                The Service is not directed to children under 16 years of age. We do not knowingly collect
                personal information from children under 16 without verifiable parental consent. If you
                believe we have inadvertently collected personal information from a child under 16, please
                contact us at {EMAIL} and we will take steps to delete that information.
              </P>
              <P>
                Where an administrator uploads attendance data for minors (e.g. in a youth organisation),
                the administrator is responsible for ensuring they have the appropriate legal authority to
                do so and that the relevant consents or authorisations are in place.
              </P>
            </Section>

            <Section id="changes" title="14. Changes to This Policy">
              <P>
                We may update this Privacy Policy from time to time to reflect changes in our practices,
                technology, or applicable law. We will notify you of material changes by updating the
                effective date at the top of this page. For significant changes affecting how we process
                your personal data, we may also send you a notification by email.
              </P>
              <P>
                Your continued use of the Service after any changes become effective constitutes your
                acceptance of the revised Privacy Policy.
              </P>
            </Section>

            <Section id="contact" title="15. Contact Us">
              <P>
                For any questions, concerns, or requests relating to this Privacy Policy or our data
                practices, please contact our privacy team:
              </P>
              <div className="bg-surface-low rounded-2xl p-5 space-y-2">
                <p className="font-bold text-white">{COMPANY}</p>
                <p>Privacy enquiries: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
                <p>General: <a href="mailto:legal@rollcally.com" className="text-primary hover:underline">legal@rollcally.com</a></p>
              </div>
            </Section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" aria-hidden="true" />
            <span className="text-white text-sm font-black tracking-tight">Rollcally</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            © {new Date().getFullYear()} {COMPANY} All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}
