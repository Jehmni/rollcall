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
}
