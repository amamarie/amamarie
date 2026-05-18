import type { Prisma } from "@prisma/client"

export type RecommendationType =
  | "PROTECTION"
  | "INVESTMENT_REVIEW"
  | "COMPLIANCE"
  | "FOLLOW_UP"
  | "CROSS_SELL_OPPORTUNITY"
  | "DATA_QUALITY"

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type RecommendationStatus =
  | "OPEN"
  | "REVIEWED"
  | "DISMISSED"
  | "CONVERTED_TO_TASK"
  | "COMPLETED"
  | "ARCHIVED"

export type RecommendationCandidate = {
  type: RecommendationType
  priority: RecommendationPriority
  title: string
  description: string
  rationale?: string
  actionLabel?: string
  actionUrl?: string
  relatedProductId?: string | null
  ruleKey: string
  confidence?: number
  metadata?: Prisma.InputJsonValue
}

export type RecommendationContext = {
  client: {
    id: string
    advisorId?: string | null
    dateOfBirth?: Date | string | null
    employmentStatus?: string | null
    annualIncome?: number | null
    approximateIncome?: number | null
    riskProfile?: string | null
    financialGoals?: string | null
    primaryGoal?: string | null
    goals?: string | null
    lastContactAt?: Date | string | null
    dependents?: number | null
    dependentsCount?: number | null
  }
  products: {
    id: string
    category: string
    type: string
    status: string
    renewalAt?: Date | string | null
    lastReviewAt?: Date | string | null
    primaryBeneficiary?: string | null
    documentStatus?: string | null
    accountValue?: number | null
  }[]
  documents: { id: string; type: string; status: string }[]
  tasks: { id: string; status: string; dueDate?: Date | string | null }[]
}
