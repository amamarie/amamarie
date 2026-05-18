type KycLike = {
  legalFirstName?: string | null
  legalLastName?: string | null
  dateOfBirth?: Date | string | null
  countryOfResidence?: string | null
  provinceOfResidence?: string | null
  annualIncome?: number | null
  incomeRange?: string | null
  netWorth?: number | null
  liquidNetWorth?: number | null
  riskProfileResult?: string | null
  riskTolerance?: string | null
  primaryObjective?: string | null
  financialGoals?: string | null
  sourceOfFunds?: string | null
  sourceOfWealth?: string | null
  investmentKnowledge?: string | null
  investmentExperience?: string | null
  riskCapacity?: string | null
  investmentHorizon?: string | null
  liquidityNeeds?: string | null
  borrowingNeeds?: string | null
  clientConfirmedNoChange?: boolean | null
  advisorAttestation?: boolean | null
  lastKycReviewAt?: Date | string | null
  nextKycReviewAt?: Date | string | null
  status?: string | null
}

type DocumentLike = { status: string; type: string }
type ConsentLike = { status: string }

export function calculateComplianceScore(
  kyc: KycLike | null | undefined,
  documents: DocumentLike[] = [],
  consents: ConsentLike[] = []
) {
  if (!kyc) return 0

  let score = 0
  if (kyc.legalFirstName && kyc.legalLastName && kyc.dateOfBirth && kyc.countryOfResidence && kyc.provinceOfResidence) score += 15
  if (kyc.annualIncome || kyc.incomeRange || kyc.netWorth || kyc.liquidNetWorth) score += 15
  if (kyc.riskProfileResult && kyc.riskProfileResult !== "UNKNOWN" && kyc.riskTolerance && kyc.riskCapacity) score += 15
  if (kyc.primaryObjective && kyc.primaryObjective !== "UNKNOWN" && (kyc.financialGoals || kyc.sourceOfWealth)) score += 10
  if (kyc.sourceOfFunds && kyc.sourceOfFunds !== "UNKNOWN") score += 10
  if (kyc.investmentHorizon && kyc.liquidityNeeds) score += 10
  if (kyc.investmentKnowledge && kyc.investmentExperience && kyc.borrowingNeeds) score += 10

  const requiredDocuments = documents.filter((document) => ["REQUIRED", "REQUESTED", "RECEIVED", "VALIDATED", "EXPIRED"].includes(document.status))
  const validDocuments = requiredDocuments.filter((document) => document.status === "VALIDATED")
  if (requiredDocuments.length === 0 || validDocuments.length >= Math.min(requiredDocuments.length, 2)) score += 10

  const activeConsents = consents.filter((consent) => consent.status === "GIVEN")
  if (activeConsents.length > 0) score += 10
  if (kyc.clientConfirmedNoChange || kyc.status === "APPROVED") score += 10
  if (kyc.advisorAttestation || kyc.status === "APPROVED") score += 10

  return Math.max(0, Math.min(100, score))
}

export function complianceScoreLabel(score: number) {
  if (score >= 90) return "Complet"
  if (score >= 70) return "Presque complet"
  if (score >= 40) return "À améliorer"
  return "Incomplet"
}
