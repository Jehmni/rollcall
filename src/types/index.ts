export type ServiceType = string
export type MemberStatus = 'active' | 'inactive'

export interface Organization {
  id: string
  name: string
  created_by_admin_id: string
  created_at: string
}

export type OrgRole = 'owner' | 'member'

export interface OrganizationMember {
  id: string
  organization_id: string
  admin_id: string
  role: OrgRole
  joined_at: string
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface JoinRequest {
  id: string
  organization_id: string
  admin_id: string
  status: JoinRequestStatus
  created_at: string
  organization?: Organization // Optional join
}

export interface Unit {
  id: string
  org_id: string
  name: string
  description: string | null
  created_by_admin_id: string
  created_at: string
}

export interface UnitWithOrg extends Unit {
  organization: Organization
}

export interface Member {
  id: string
  unit_id: string
  name: string
  phone: string | null
  section: string | null    // e.g. "Soprano", "Senior", "Team A" — unit-defined
  status: MemberStatus
  birthday: string | null
  sms_consent: boolean | null  // null = not asked, true = consented, false = opted out
  created_at: string
}

export interface MemberNotification {
  id: string
  unit_id: string
  member_id: string
  member_name: string
  type: 'birthday_eve' | 'birthday_day'
  fire_at: string
}

export interface Service {
  id: string
  unit_id: string
  date: string
  service_type: ServiceType
  notification_sent_at: string | null
  require_location: boolean
  created_at: string
}

export interface Attendance {
  id: string
  member_id: string
  service_id: string
  checkin_time: string
  created_at: string
}

export interface DashboardMember {
  id: string
  name: string
  phone: string | null
  section: string | null
  checked_in: boolean
  checkin_time: string | null
  sms_consent: boolean | null  // null = not asked, true = consented, false = opted out
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'

export interface PricingPlan {
  id:               string   // 'starter' | 'growth' | 'pro'
  display_name:     string
  price_usd_cents:  number
  credits_included: number
  sort_order:       number
}

export interface Subscription {
  id:                     string
  org_id:                 string
  stripe_customer_id:     string
  stripe_subscription_id: string | null
  plan_id:                string
  status:                 SubscriptionStatus
  credits_included:       number
  current_period_end:     string | null
  cancel_at_period_end:   boolean
  created_at:             string
  updated_at:             string
}

export interface SmsCredits {
  org_id:        string
  balance:       number
  last_reset_at: string
}

export interface OrgBilling {
  subscription: Subscription | null
  credits:      SmsCredits | null
  plan:         PricingPlan | null
}

// ─── Absence Messaging ────────────────────────────────────────────────────────

export interface UnitMessagingSettings {
  unit_id: string
  enabled: boolean
  message_template: string
  send_hour: number       // 12–21 (noon–9 pm), local time
  timezone: string        // IANA timezone, e.g. 'Africa/Lagos'
  sender_name: string | null  // Alphanumeric sender ID (max 11 chars), shown as "From" in SMS
  cooldown_days: number   // Min days between messages to same member (0 = no cooldown)
  updated_at: string
}

export type MessageStatus = 'sent' | 'failed' | 'skipped'

export interface AbsenceMessageLogEntry {
  id: string
  service_id: string
  member_id: string
  phone: string
  message: string
  status: MessageStatus
  error_text: string | null
  sent_at: string
}
