export type Role = 'admin' | 'finance' | 'support'

export interface Profile {
  id: string
  name: string
  role: Role
  created_at: string
}

export type SubscriptionType =
  | 'Swing with Stockifyy'
  | 'Trade with Stockifyy'
  | 'Invest with Stockifyy'
  | 'Technical Analysis Course'

export interface Customer {
  id: string
  name: string
  client_code: string | null
  mobile: string
  subscription_type: SubscriptionType
  amount: number
  discount: number | null
  subscription_start: string | null
  subscription_end: string | null
  notes: string | null
  screenshot_url: string | null
  added_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  added_by_profile?: Profile
  updated_by_profile?: Profile
}

export interface PortfolioClient {
  id: string
  full_name: string
  client_code: string
  phone: string
  duration: string
  capital: number
  notes: string | null
  added_by: string | null
  created_at: string
  added_by_profile?: Profile
}

export interface AdvisoryClient {
  id: string
  full_name: string
  client_code: string
  phone: string
  mentor: string
  adding_date: string
  notes: string | null
  added_by: string | null
  created_at: string
  added_by_profile?: Profile
}

export interface Comment {
  id: string
  customer_id: string
  author_id: string
  text: string
  created_at: string
  author?: Profile
}

export interface CustomerWithComments extends Customer {
  comments: Comment[]
}

export function subStatus(endDate: string | null | undefined): 'active' | 'expiring' | 'expired' {
  if (!endDate) return 'active'
  const now = new Date()
  const end = new Date(endDate)
  const diffDays = (end.getTime() - now.getTime()) / 86400000
  if (diffDays < 0) return 'expired'
  if (diffDays <= 1) return 'expiring'
  return 'active'
}

export const SUB_TYPES: SubscriptionType[] = [
  'Swing with Stockifyy',
  'Trade with Stockifyy',
  'Invest with Stockifyy',
  'Technical Analysis Course',
]
