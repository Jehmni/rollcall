import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = 'April 2, 2026'
const COMPANY = 'Rollcally Inc.'
const EMAIL = 'legal@rollcally.com'

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

const TOC = [
  { id: 'acceptance', label: '1. Acceptance of Terms' },
  { id: 'service', label: '2. Description of Service' },
  { id: 'eligibility', label: '3. Eligibility' },
  { id: 'accounts', label: '4. Administrator Accounts' },
  { id: 'members', label: '5. Member Data' },
  { id: 'acceptable-use', label: '6. Acceptable Use' },
  { id: 'intellectual-property', label: '7. Intellectual Property' },
  { id: 'data-processing', label: '8. Data Processing' },
  { id: 'notifications', label: '9. Push Notifications' },
  { id: 'sms-messaging', label: '10. SMS Absence Messaging' },
  { id: 'subscriptions', label: '11. Subscriptions & Billing' },
  { id: 'third-parties', label: '12. Third-Party Services' },
  { id: 'disclaimers', label: '13. Disclaimers' },
  { id: 'liability', label: '14. Limitation of Liability' },
  { id: 'indemnification', label: '15. Indemnification' },
  { id: 'termination', label: '16. Termination' },
  { id: 'changes', label: '17. Changes to These Terms' },
  { id: 'governing-law', label: '18. Governing Law' },
  { id: 'contact', label: '19. Contact Us' },
]

export default function TermsOfService() {
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
            to="/privacy"
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-primary transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 lg:py-20">

        {/* Hero */}
        <div className="mb-14 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 mb-6">
            <span className="material-symbols-outlined text-primary text-sm">gavel</span>
            <span className="text-2xs font-black uppercase tracking-widest text-primary">Legal</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Terms of Service</h1>
          <p className="text-slate-400 text-base font-medium">
            Effective date: <span className="text-slate-300">{EFFECTIVE_DATE}</span>
          </p>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl leading-relaxed">
            Please read these Terms carefully before using Rollcally. By accessing or using our service,
            you agree to be bound by these Terms. If you do not agree, do not use the service.
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

            <Section id="acceptance" title="1. Acceptance of Terms">
              <P>
                These Terms of Service ("Terms") constitute a legally binding agreement between you and {COMPANY}
                ("Rollcally", "we", "us", or "our") governing your access to and use of the Rollcally platform,
                including the web application, mobile progressive web app (PWA), and related services
                (collectively, the "Service").
              </P>
              <P>
                By creating an account, accessing the Service, or clicking any button that indicates your acceptance,
                you confirm that you have read, understood, and agree to be bound by these Terms and our
                Privacy Policy, incorporated herein by reference.
              </P>
            </Section>

            <Section id="service" title="2. Description of Service">
              <P>
                Rollcally is an attendance management platform that enables organisations to track member attendance
                at events and sessions using QR code check-ins, manage membership rosters, send push notifications
                to members, and analyse attendance trends.
              </P>
              <P>The Service is structured around the following hierarchy:</P>
              <Ul items={[
                'Organisations — top-level entities created and owned by administrators.',
                'Units — sub-groups within an organisation (e.g. departments, teams, sections).',
                'Members — individuals whose attendance is tracked within a unit.',
                'Events / Sessions — scheduled occurrences for which attendance is recorded.',
              ]} />
              <P>
                We reserve the right to modify, suspend, or discontinue any part of the Service at any time,
                with or without notice. We will endeavour to provide reasonable advance notice of material changes.
              </P>
            </Section>

            <Section id="eligibility" title="3. Eligibility">
              <P>You must be at least 16 years of age to create an administrator account. By using the Service, you represent and warrant that:</P>
              <Ul items={[
                'You are at least 16 years old, or have obtained verifiable parental or guardian consent.',
                'You have the legal capacity and authority to enter into these Terms.',
                'Your use of the Service does not violate any applicable law or regulation.',
                'If you are using the Service on behalf of an organisation, you have authority to bind that organisation to these Terms.',
              ]} />
            </Section>

            <Section id="accounts" title="4. Administrator Accounts">
              <P>
                To use the administrative features of the Service, you must register for an account using a valid
                email address and password. You are responsible for:
              </P>
              <Ul items={[
                'Maintaining the confidentiality of your account credentials.',
                'All activity that occurs under your account.',
                'Notifying us immediately of any unauthorised use of your account at ' + EMAIL + '.',
                'Ensuring the information associated with your account remains accurate and up to date.',
              ]} />
              <P>
                We reserve the right to suspend or terminate your account if we have reason to believe your
                account has been compromised or is being used in violation of these Terms.
              </P>
            </Section>

            <Section id="members" title="5. Member Data">
              <P>
                As an administrator, you may upload and manage personal data relating to members of your
                organisation, including names, phone numbers, sections, and birthdays. By doing so, you
                represent and warrant that:
              </P>
              <Ul items={[
                'You have a lawful basis to collect and process each member\'s personal data.',
                'You have obtained any necessary consents from members, or can demonstrate another lawful basis under applicable data protection law.',
                'The data you upload is accurate and you will keep it up to date.',
                'You will honour any requests from members to access, correct, or delete their personal data.',
              ]} />
              <P>
                Rollcally acts as a data processor in respect of member data you upload. You remain the data
                controller. Our processing of such data is governed by our Data Processing Agreement and
                Privacy Policy.
              </P>
            </Section>

            <Section id="acceptable-use" title="6. Acceptable Use">
              <P>You agree not to use the Service to:</P>
              <Ul items={[
                'Violate any applicable local, national, or international law or regulation.',
                'Upload or transmit any data that infringes the intellectual property rights of any third party.',
                'Transmit unsolicited or unauthorised advertising or promotional material.',
                'Introduce any virus, Trojan horse, worm, or other malicious or harmful code.',
                'Attempt to gain unauthorised access to any part of the Service or its related systems.',
                'Use automated tools to scrape, crawl, or extract data from the Service without our prior written consent.',
                'Impersonate any person or organisation, or misrepresent your affiliation with any person or organisation.',
                'Use the Service in any manner that could damage, disable, overburden, or impair it.',
                'Process the personal data of individuals in a manner that violates applicable data protection laws.',
              ]} />
            </Section>

            <Section id="intellectual-property" title="7. Intellectual Property">
              <P>
                The Service and all of its original content, features, and functionality (including but not limited
                to the software, design, text, graphics, logos, and icons) are owned by {COMPANY} and are
                protected by intellectual property laws in applicable jurisdictions.
              </P>
              <P>
                Subject to your compliance with these Terms, we grant you a limited, non-exclusive,
                non-transferable, revocable licence to access and use the Service solely for your internal
                organisational purposes.
              </P>
              <P>
                You retain all ownership rights in the data you upload to the Service. By uploading data, you
                grant us a limited licence to process that data solely for the purpose of providing the Service
                to you.
              </P>
            </Section>

            <Section id="data-processing" title="8. Data Processing">
              <P>
                Rollcally collects and processes personal data in accordance with our Privacy Policy and
                applicable data protection legislation, including the General Data Protection Regulation (GDPR)
                where applicable, the UK GDPR, and the California Consumer Privacy Act (CCPA).
              </P>
              <P>
                As an administrator, you are responsible for ensuring that your use of the Service, including
                the personal data you upload and the manner in which you use the Service, complies with all
                applicable data protection laws. We recommend you maintain your own privacy notice for your
                members that accurately describes your data processing activities.
              </P>
            </Section>

            <Section id="notifications" title="9. Push Notifications">
              <P>
                The Service includes an optional push notification feature. Members who have checked in to
                events may consent to receive push notifications. Rollcally will only send push notifications
                where a member has granted permission through their browser or device.
              </P>
              <P>
                As an administrator, you agree to use the notification feature only for legitimate attendance
                and event-related communications relevant to your organisation. Mass or unsolicited notifications
                unrelated to the Service's purpose are prohibited.
              </P>
              <P>
                Members may withdraw their consent to receive push notifications at any time through their
                browser or device settings.
              </P>
            </Section>

            <Section id="sms-messaging" title="10. SMS Absence Messaging">
              <P>
                The Service includes an optional SMS absence notification feature. The following terms
                govern its use by administrators and members.
              </P>
              <P><strong className="text-white">Administrator obligations</strong></P>
              <Ul items={[
                'You may only enable SMS messaging for members who have provided explicit, informed consent as recorded in the Service.',
                'You must configure a sender name that accurately identifies your unit or organisation. Misleading or impersonating sender names are prohibited.',
                'You must use the messaging feature only for legitimate absence notifications relevant to your unit\'s activities. Promotional, marketing, or off-topic messages are prohibited.',
                'You acknowledge that SMS delivery is subject to carrier routing, geographic restrictions, and provider terms. Rollcally does not guarantee delivery.',
                'Standard SMS rates may apply to message recipients. You are responsible for informing members that they may incur carrier charges.',
              ]} />
              <P><strong className="text-white">Member rights</strong></P>
              <Ul items={[
                'Members may consent to or opt out of SMS absence notifications via the check-in page at any time.',
                'Members may also ask an administrator to update their SMS preference on their behalf.',
                'Withdrawal of consent will be honoured at the next scheduled send — messages already queued at the time of withdrawal may still be delivered.',
              ]} />
              <P>
                Rollcally reserves the right to suspend or terminate SMS sending for any unit that uses
                the feature in violation of these Terms or applicable law (including anti-spam legislation
                such as the UK Privacy and Electronic Communications Regulations, GDPR, and the US
                Telephone Consumer Protection Act).
              </P>
            </Section>

            <Section id="subscriptions" title="11. Subscriptions & Billing">
              <P><strong className="text-white">Plans and pricing</strong></P>
              <P>
                Access to the automated absence follow-up feature requires an active paid subscription.
                Rollcally offers monthly subscription plans (Starter, Growth, and Pro) at prices published
                on the billing page within the Service. Prices are in US Dollars and are subject to change
                with 30 days' notice.
              </P>

              <P><strong className="text-white">Free trial</strong></P>
              <P>
                New subscribers receive a 14-day free trial on their first subscription. No payment is
                charged during the trial period. At the end of the trial, your subscription automatically
                converts to the selected paid plan. You may cancel at any time during the trial without charge.
              </P>

              <P><strong className="text-white">Billing and payment</strong></P>
              <Ul items={[
                'Subscriptions are billed monthly in advance. Your billing cycle begins on the date you subscribe.',
                'Payment is processed by Stripe. By subscribing, you authorise Stripe to charge your payment method on a recurring monthly basis.',
                'You are responsible for ensuring your payment information remains current. If payment fails, we will notify you and your subscription will enter a grace period. If payment is not resolved, follow-up messaging will be suspended.',
                'All prices are exclusive of any applicable taxes. You are responsible for any taxes applicable in your jurisdiction.',
              ]} />

              <P><strong className="text-white">Follow-up allowance</strong></P>
              <Ul items={[
                'Each plan includes a monthly allowance of automated follow-up messages. This allowance resets at the start of each billing cycle.',
                'Unused allowance does not roll over to the next cycle.',
                'The allowance is shared across all units within an organisation. If multiple units are using the follow-up feature, they draw from the same pool.',
                'When the allowance is exhausted, no further follow-up messages will be sent until the next billing cycle or until you upgrade your plan.',
              ]} />

              <P><strong className="text-white">Upgrades and downgrades</strong></P>
              <Ul items={[
                'You may upgrade your plan at any time. The upgraded allowance is applied immediately; you are charged a prorated amount for the remainder of the current billing period.',
                'You may downgrade your plan at any time. The downgrade takes effect at the start of the next billing cycle.',
                'Plan changes are managed through the Stripe Billing Portal, accessible from the Billing page.',
              ]} />

              <P><strong className="text-white">Cancellation and refunds</strong></P>
              <Ul items={[
                'You may cancel your subscription at any time from the Billing page. Cancellation takes effect at the end of the current billing period. You retain access to the Service until that date.',
                'We do not offer prorated refunds for the unused portion of a billing period following cancellation, except where required by applicable law.',
                'If you believe you have been charged in error, contact us at ' + EMAIL + ' within 30 days of the charge.',
              ]} />

              <P><strong className="text-white">Suspension for non-payment</strong></P>
              <P>
                If your subscription lapses due to non-payment or cancellation, automated follow-up messaging
                will be disabled. Your data (members, attendance records, settings) will remain accessible
                for a period of 90 days, after which we reserve the right to archive or delete it. We will
                provide reasonable notice before any such action.
              </P>
            </Section>

            <Section id="third-parties" title="12. Third-Party Services">
              <P>
                The Service is built on and integrates with third-party infrastructure providers, including
                Supabase (database and authentication) and Stripe (payment processing). By using the Service,
                you acknowledge that your data may be stored on infrastructure operated by these providers.
                We select providers that offer strong security and data protection commitments.
              </P>
              <P>
                Payment processing is handled exclusively by Stripe. Your payment card details are
                transmitted directly to Stripe and are never stored by Rollcally. Your use of Stripe's
                services is subject to Stripe's own terms of service and privacy policy, available at
                stripe.com.
              </P>
              <P>
                SMS delivery is handled by Twilio (or Africa's Talking, depending on configuration).
                By enabling SMS absence messaging, you acknowledge that message content and recipient
                phone numbers are transmitted to these providers for delivery purposes.
              </P>
              <P>
                We are not responsible for the privacy practices or content of any third-party websites or
                services that may be linked from within the Service.
              </P>
            </Section>

            <Section id="disclaimers" title="13. Disclaimers">
              <P>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
                EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </P>
              <P>
                We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or
                other harmful components. We do not warrant the accuracy, completeness, or reliability of
                any content or data available through the Service.
              </P>
            </Section>

            <Section id="liability" title="14. Limitation of Liability">
              <P>
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL {COMPANY.toUpperCase()},
                ITS DIRECTORS, EMPLOYEES, PARTNERS, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR
                OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF OR INABILITY TO USE
                THE SERVICE.
              </P>
              <P>
                IN NO EVENT WILL OUR TOTAL LIABILITY TO YOU EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID
                US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS (USD $100).
              </P>
              <P>
                Some jurisdictions do not allow the exclusion or limitation of certain warranties or damages.
                In such jurisdictions, our liability is limited to the maximum extent permitted by applicable law.
              </P>
            </Section>

            <Section id="indemnification" title="15. Indemnification">
              <P>
                You agree to defend, indemnify, and hold harmless {COMPANY}, its officers, directors,
                employees, and agents from and against any claims, liabilities, damages, judgments, awards,
                losses, costs, expenses, or fees (including reasonable legal fees) arising out of or relating
                to your violation of these Terms or your use of the Service, including but not limited to any
                data you upload, your violation of any third party's rights, or your violation of any
                applicable law.
              </P>
            </Section>

            <Section id="termination" title="16. Termination">
              <P>
                We may suspend or terminate your access to the Service, with or without notice, for conduct
                that we believe violates these Terms, is harmful to other users or to us, or for any other
                reason at our sole discretion.
              </P>
              <P>
                You may terminate your account at any time by contacting us at {EMAIL}. Upon termination, your
                right to access and use the Service will immediately cease. We will delete or anonymise your
                personal data in accordance with our Privacy Policy.
              </P>
              <P>
                Provisions that by their nature should survive termination will survive, including ownership
                provisions, warranty disclaimers, indemnity, and limitations of liability.
              </P>
            </Section>

            <Section id="changes" title="17. Changes to These Terms">
              <P>
                We reserve the right to modify these Terms at any time. We will provide notice of material
                changes by updating the effective date at the top of this page. For significant changes, we
                may also notify you by email or through a prominent notice within the Service.
              </P>
              <P>
                Your continued use of the Service after any changes become effective constitutes your acceptance
                of the revised Terms. If you do not agree with the revised Terms, you must stop using the Service.
              </P>
            </Section>

            <Section id="governing-law" title="18. Governing Law">
              <P>
                These Terms are governed by and construed in accordance with the laws of England and Wales,
                without regard to its conflict of law provisions. You consent to the exclusive jurisdiction
                of the courts of England and Wales for any dispute arising from these Terms or your use of
                the Service.
              </P>
              <P>
                If you are a consumer resident in the European Union, you may also have the right to bring
                proceedings in the courts of the country in which you are domiciled. Nothing in these Terms
                affects your statutory rights as a consumer under applicable EU or local law.
              </P>
            </Section>

            <Section id="contact" title="19. Contact Us">
              <P>
                If you have any questions about these Terms, please contact us:
              </P>
              <div className="bg-surface-low rounded-2xl p-5 space-y-2">
                <p className="font-bold text-white">{COMPANY}</p>
                <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
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
