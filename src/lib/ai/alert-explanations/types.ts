import type { ComplianceAlertSeverity } from "@prisma/client"

export const AI_ALERT_PROMPT_VERSION = "alert-explanations-v1"
export const AI_ALERT_MODEL_NAME = "local-safe-explainer"

export type AiAlertActionType =
  | "CREATE_TASK"
  | "CREATE_NOTE"
  | "REQUEST_DOCUMENT"
  | "SCHEDULE_REVIEW"
  | "UPDATE_CLIENT_FIELD"
  | "UPDATE_PRODUCT_FIELD"
  | "MARK_ALERT_REVIEWED"

export type AiAlertPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type AlertExplanationContext = {
  alert: {
    id: string
    type: string
    severity: ComplianceAlertSeverity
    title: string
    description: string
    actionLabel: string | null
    updatedAt: Date
  }
  client: {
    id: string
    firstName: string
    lastName: string
    status: string
    age: number | null
    familyStatus: string | null
    dependentsCount: number | null
    riskProfile: string | null
    financialGoals: string | null
    lastContactAt: Date | null
    updatedAt: Date
  }
  kyc: {
    status: string
    sourceOfFunds: string | null
    primaryObjective: string | null
    riskProfileResult: string | null
    complianceScore: number
    updatedAt: Date
  } | null
  products: {
    id: string
    category: string
    type: string
    status: string
    renewalAt: Date | null
    lastReviewAt: Date | null
    primaryBeneficiary: string | null
    documentStatus: string | null
    updatedAt: Date
  }[]
  documents: {
    id: string
    type: string
    status: string
    updatedAt: Date
  }[]
  openTasks: {
    id: string
    title: string
    priority: string
    dueDate: Date | null
    updatedAt: Date
  }[]
}
