type KycEvaluationInput = {
  legalFirstName?: string | null
  legalLastName?: string | null
  dateOfBirth?: Date | string | null
  countryOfResidence?: string | null
  provinceOfResidence?: string | null
  maritalStatus?: string | null
  dependentsCount?: number | null
  employmentStatus?: string | null
  occupation?: string | null
  annualIncome?: number | null
  incomeRange?: string | null
  totalAssets?: number | null
  netWorth?: number | null
  liquidNetWorth?: number | null
  totalLiabilities?: number | null
  monthlyExpenses?: number | null
  emergencyFund?: number | null
  sourceOfFunds?: string | null
  sourceOfWealth?: string | null
  primaryObjective?: string | null
  financialGoals?: string | null
  investmentHorizon?: string | null
  liquidityNeeds?: string | null
  investmentKnowledge?: string | null
  investmentExperience?: string | null
  riskTolerance?: string | null
  riskCapacity?: string | null
  riskProfileResult?: string | null
  borrowingNeeds?: string | null
  advisorOverride?: boolean | null
  advisorOverrideReason?: string | null
  clientConfirmedNoChange?: boolean | null
  advisorAttestation?: boolean | null
  lastKycReviewAt?: Date | string | null
  nextKycReviewAt?: Date | string | null
  status?: string | null
}

export type KycEngineAlert = {
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  description: string
}

const riskScoreMap: Record<string, number> = {
  CONSERVATIVE: 1,
  LOW: 1,
  MODERATE_LOW: 2,
  MEDIUM: 3,
  MODERATE: 3,
  BALANCED: 3,
  GROWTH: 4,
  AGGRESSIVE: 5,
  HIGH: 5,
}

const riskProfileFromScore: Record<number, string> = {
  1: "CONSERVATIVE",
  2: "MODERATE_LOW",
  3: "MODERATE",
  4: "GROWTH",
  5: "AGGRESSIVE",
}

function hasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0 && value !== "UNKNOWN"
  return value !== null && value !== undefined
}

function scoreRisk(value?: string | null) {
  if (!value) return null
  return riskScoreMap[String(value).toUpperCase()] ?? null
}

function horizonScore(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase()
  if (!normalized) return null
  if (normalized.includes("SHORT") || normalized.includes("COURT") || normalized.includes("0-2") || normalized.includes("1-3")) return 1
  if (normalized.includes("MEDIUM") || normalized.includes("MOYEN") || normalized.includes("3-5")) return 3
  if (normalized.includes("LONG") || normalized.includes("10") || normalized.includes("PLUS")) return 5
  return null
}

function liquidityScore(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase()
  if (!normalized) return null
  if (normalized.includes("HIGH") || normalized.includes("ÉLEV") || normalized.includes("ELEV")) return 1
  if (normalized.includes("MEDIUM") || normalized.includes("MOYEN")) return 3
  if (normalized.includes("LOW") || normalized.includes("FAIBLE")) return 5
  return null
}

function dateAgeInMonths(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

function isPast(value?: Date | string | null) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now()
}

export function evaluateKycProfile(kyc: KycEvaluationInput | null | undefined) {
  if (!kyc) {
    return {
      completionScore: 0,
      freshnessScore: 0,
      coherenceScore: 0,
      recommendationReady: false,
      finalRiskProfile: "UNKNOWN",
      finalRiskScore: null,
      missingFields: ["Profil client"],
      alerts: [{
        type: "KYC_PROFILE_MISSING",
        severity: "HIGH" as const,
        title: "Profil client absent",
        description: "Un profil client doit être créé avant une recommandation documentée.",
      }],
    }
  }

  const required = [
    ["Identité", kyc.legalFirstName && kyc.legalLastName && kyc.dateOfBirth],
    ["Résidence", kyc.countryOfResidence && kyc.provinceOfResidence],
    ["Situation personnelle", kyc.maritalStatus],
    ["Emploi", kyc.employmentStatus && kyc.occupation],
    ["Revenu", kyc.annualIncome || kyc.incomeRange],
    ["Actifs ou valeur nette", kyc.totalAssets || kyc.netWorth],
    ["Passifs", typeof kyc.totalLiabilities === "number"],
    ["Liquidités", kyc.liquidNetWorth || kyc.emergencyFund || kyc.liquidityNeeds],
    ["Objectif", kyc.primaryObjective || kyc.financialGoals],
    ["Horizon", kyc.investmentHorizon],
    ["Connaissances financières", kyc.investmentKnowledge],
    ["Expérience de placement", kyc.investmentExperience],
    ["Tolérance au risque", kyc.riskTolerance],
    ["Capacité de risque", kyc.riskCapacity],
    ["Profil de risque final", kyc.riskProfileResult],
    ["Source des fonds", kyc.sourceOfFunds],
    ["Source de richesse", kyc.sourceOfWealth],
    ["Levier financier", kyc.borrowingNeeds],
  ] as const
  const missingFields = required.filter(([, done]) => !hasValue(done)).map(([label]) => label)
  const completionScore = Math.round(((required.length - missingFields.length) / required.length) * 100)

  const reviewAge = dateAgeInMonths(kyc.lastKycReviewAt ?? kyc.nextKycReviewAt)
  const freshnessScore = isPast(kyc.nextKycReviewAt)
    ? 25
    : reviewAge === null
      ? 55
      : Math.max(40, Math.min(100, 100 - Math.max(0, reviewAge - 12) * 3))

  const tolerance = scoreRisk(kyc.riskTolerance)
  const capacity = scoreRisk(kyc.riskCapacity)
  const horizon = horizonScore(kyc.investmentHorizon)
  const liquidity = liquidityScore(kyc.liquidityNeeds)
  const finalRiskScore = Math.min(...[tolerance, capacity, horizon, liquidity].filter((value): value is number => typeof value === "number"))
  const finalRiskProfile = Number.isFinite(finalRiskScore) ? riskProfileFromScore[finalRiskScore] : (kyc.riskProfileResult ?? "UNKNOWN")
  const declaredRisk = scoreRisk(kyc.riskProfileResult)
  const alerts: KycEngineAlert[] = []

  if (missingFields.length > 0) {
    alerts.push({
      type: "KYC_COMPLETENESS_GAP",
      severity: missingFields.length >= 5 ? "HIGH" : "MEDIUM",
      title: "Profil client incomplet",
      description: `Champs à compléter: ${missingFields.slice(0, 8).join(", ")}${missingFields.length > 8 ? "..." : ""}.`,
    })
  }
  if (isPast(kyc.nextKycReviewAt)) {
    alerts.push({
      type: "KYC_UPDATE_REQUIRED",
      severity: "HIGH",
      title: "Mise à jour du profil client requise",
      description: "La date de prochaine révision est dépassée. Le profil ne doit pas servir à une recommandation sans mise à jour.",
    })
  }
  if (tolerance !== null && capacity !== null && tolerance > capacity) {
    alerts.push({
      type: "KYC_RISK_TOLERANCE_CAPACITY_CONFLICT",
      severity: "HIGH",
      title: "Tolérance supérieure à la capacité",
      description: "Le profil final devrait refléter la capacité de risque plus prudente, sauf justification documentée.",
    })
  }
  if (horizon !== null && horizon <= 2 && declaredRisk !== null && declaredRisk >= 4) {
    alerts.push({
      type: "KYC_SHORT_HORIZON_HIGH_RISK",
      severity: "HIGH",
      title: "Horizon court et risque élevé",
      description: "Un horizon court semble incohérent avec un profil de risque élevé ou croissance.",
    })
  }
  if (liquidity !== null && liquidity <= 2 && declaredRisk !== null && declaredRisk >= 4) {
    alerts.push({
      type: "KYC_LIQUIDITY_RISK_CONFLICT",
      severity: "HIGH",
      title: "Besoin de liquidité élevé",
      description: "Un besoin de liquidité élevé peut rendre une recommandation illiquide ou agressive inadéquate sans justification.",
    })
  }
  if (String(kyc.investmentKnowledge ?? "").toUpperCase().includes("BEGINNER") && declaredRisk !== null && declaredRisk >= 4) {
    alerts.push({
      type: "KYC_KNOWLEDGE_COMPLEXITY_CONFLICT",
      severity: "MEDIUM",
      title: "Connaissance financière limitée",
      description: "Le niveau de connaissance devrait être cohérent avec la complexité ou le risque des produits recommandés.",
    })
  }
  if (String(kyc.borrowingNeeds ?? "").toUpperCase().includes("YES") || String(kyc.borrowingNeeds ?? "").toUpperCase().includes("LEVER")) {
    alerts.push({
      type: "KYC_LEVERAGE_DOCUMENTATION_REQUIRED",
      severity: "HIGH",
      title: "Levier financier à documenter",
      description: "L’utilisation d’emprunt ou de levier exige une capacité de remboursement et une justification au dossier.",
    })
  }
  if (kyc.advisorOverride && !kyc.advisorOverrideReason) {
    alerts.push({
      type: "KYC_OVERRIDE_REASON_REQUIRED",
      severity: "HIGH",
      title: "Justification de dérogation requise",
      description: "Le conseiller a modifié ou contourné le résultat calculé sans justification documentée.",
    })
  }

  const coherenceScore = Math.max(0, 100 - alerts.filter((alert) => alert.type.includes("CONFLICT") || alert.type.includes("OVERRIDE")).length * 25)
  const recommendationReady = completionScore >= 85
    && freshnessScore >= 60
    && coherenceScore >= 70
    && Boolean(kyc.clientConfirmedNoChange || kyc.status === "APPROVED")
    && Boolean(kyc.advisorAttestation || kyc.status === "APPROVED")

  return {
    completionScore,
    freshnessScore,
    coherenceScore,
    recommendationReady,
    finalRiskProfile,
    finalRiskScore: Number.isFinite(finalRiskScore) ? finalRiskScore : null,
    missingFields,
    alerts,
  }
}

export function assertKycReadyForRecommendation(kyc: KycEvaluationInput | null | undefined) {
  const evaluation = evaluateKycProfile(kyc)
  if (!evaluation.recommendationReady) {
    const reason = evaluation.alerts[0]?.title ?? evaluation.missingFields[0] ?? "Profil client non prêt"
    throw new Error(`KYC_RECOMMENDATION_BLOCKED:${reason}`)
  }
  return evaluation
}
