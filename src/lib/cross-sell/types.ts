import type { Prisma } from "@prisma/client"

export type CrossSellCategory =
  | "PROTECTION"
  | "INVESTMENT"
  | "FAMILY_NEEDS"
  | "RETIREMENT"
  | "TAX_EFFICIENCY"
  | "BUSINESS_OWNER"
  | "REVIEW_OPPORTUNITY"

export type CrossSellPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type CrossSellStatus =
  | "OPEN"
  | "REVIEWED"
  | "DISMISSED"
  | "CONVERTED_TO_TASK"
  | "DISCUSSED"
  | "WON"
  | "LOST"
  | "ARCHIVED"

export type CrossSellCandidate = {
  category: CrossSellCategory
  priority: CrossSellPriority
  title: string
  description: string
  rationale?: string
  actionLabel?: string
  actionUrl?: string
  suggestedDiscussionTopic?: string
  relatedProductType?: string | null
  relatedProductId?: string | null
  ruleKey: string
  confidence?: number
  score?: number
  metadata?: Prisma.InputJsonValue
}

export type CrossSellContext = {
  client: {
    id: string
    advisorId?: string | null
    status?: string | null
    dateOfBirth?: Date | string | null
    employmentStatus?: string | null
    isSelfEmployed?: boolean
    annualIncome?: number | null
    approximateIncome?: number | null
    primaryGoal?: string | null
    lastContactAt?: Date | string | null
    dependents?: number | null
    dependentsCount?: number | null
    hasChildren?: boolean
  }
  products: {
    id: string
    category: string
    type: string
    status: string
    renewalAt?: Date | string | null
    lastReviewAt?: Date | string | null
    primaryBeneficiary?: string | null
  }[]
}
