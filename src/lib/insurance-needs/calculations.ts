import type { InsuranceAnalysisType, Prisma } from "@prisma/client"

export type AnalysisInputMap = Record<string, unknown>
export type AnalysisAssumptionMap = Record<string, number | string | boolean | null | undefined>

export type InsuranceCalculationResult = {
  needCategory: string
  grossNeed: number
  existingCoverage: number
  availableAssetsOffset: number
  netNeed: number
  gapAmount: number
  calculationDetails: Prisma.InputJsonValue
}

export type InsuranceCalculation = {
  results: InsuranceCalculationResult[]
  recommendedProductType: string
  recommendedAmount: number
  recommendedTerm: string
  reasoning: string
  alternativesConsidered: Array<{ label: string; amount: number; note: string }>
  missingData: string[]
}

function money(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""))
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
  }
  return fallback
}

function integer(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : fallback
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function assumptionNumber(assumptions: AnalysisAssumptionMap, key: string, fallback: number) {
  return money(assumptions[key], fallback)
}

function roundToNearest(value: number, step = 25000) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value / step) * step
}

export function calculateInsuranceNeeds({
  type,
  inputs,
  assumptions,
}: {
  type: InsuranceAnalysisType
  inputs: AnalysisInputMap
  assumptions: AnalysisAssumptionMap
}): InsuranceCalculation {
  if (type === "DISABILITY") return calculateDisability(inputs, assumptions)
  if (type === "CRITICAL_ILLNESS") return calculateCriticalIllness(inputs, assumptions)
  if (type === "BUSINESS") return calculateBusiness(inputs, assumptions)
  if (type === "REPLACEMENT") return calculateReplacement(inputs)
  return calculateLife(inputs, assumptions)
}

function calculateLife(inputs: AnalysisInputMap, assumptions: AnalysisAssumptionMap): InsuranceCalculation {
  const annualIncome = money(inputs.annualIncome)
  const spouseIncome = money(inputs.spouseIncome)
  const mortgage = money(inputs.mortgageBalance)
  const liabilities = money(inputs.liabilities)
  const liquidAssets = money(inputs.liquidAssets)
  const existingPersonalLifeCoverage = money(inputs.existingPersonalLifeCoverage)
  const groupLifeCoverage = money(inputs.groupLifeCoverage)
  const existingCoverage = money(inputs.existingLifeCoverage, existingPersonalLifeCoverage + groupLifeCoverage)
  const childrenCount = integer(inputs.childrenCount)
  const incomeYears = assumptionNumber(assumptions, "incomeReplacementYears", 10)
  const finalExpenses = assumptionNumber(assumptions, "finalExpenses", 25000)
  const educationPerChild = assumptionNumber(assumptions, "educationPerChild", 50000)
  const emergencyMonths = assumptionNumber(assumptions, "emergencyMonths", 6)
  const monthlyExpenses = money(inputs.monthlyExpenses, annualIncome > 0 ? annualIncome / 12 * 0.6 : 0)
  const legacyGoal = money(inputs.legacyGoal)
  const estateLiquidityNeed = money(inputs.estateLiquidityNeed)
  const beneficiariesConfirmed = inputs.beneficiariesConfirmed === true || inputs.beneficiariesConfirmed === "true" || inputs.beneficiariesConfirmed === "oui"
  const policyDocumented = inputs.policyDocumented === true || inputs.policyDocumented === "true" || inputs.policyDocumented === "oui"

  const incomeReplacement = annualIncome * incomeYears
  const education = childrenCount * educationPerChild
  const emergencyFund = monthlyExpenses * emergencyMonths
  const grossNeed = mortgage + liabilities + finalExpenses + incomeReplacement + education + emergencyFund + estateLiquidityNeed + legacyGoal
  const netNeed = Math.max(0, grossNeed - existingCoverage - liquidAssets)
  const recommendedAmount = roundToNearest(netNeed)
  const missingData = [
    !annualIncome ? "Revenu annuel" : null,
    existingCoverage === 0 ? "Protection vie existante ou confirmation d’absence de protection" : null,
    existingCoverage > 0 && !policyDocumented ? "Document de police existante" : null,
    existingCoverage > 0 && !beneficiariesConfirmed ? "Bénéficiaires confirmés" : null,
  ].filter(Boolean) as string[]

  return {
    results: [{
      needCategory: "Assurance vie",
      grossNeed,
      existingCoverage,
      availableAssetsOffset: liquidAssets,
      netNeed,
      gapAmount: netNeed,
      calculationDetails: {
        annualIncome,
        spouseIncome,
        mortgage,
        liabilities,
        finalExpenses,
        incomeReplacement,
        education,
        emergencyFund,
        estateLiquidityNeed,
        legacyGoal,
        existingPersonalLifeCoverage,
        groupLifeCoverage,
        liquidAssets,
        beneficiariesConfirmed,
        policyDocumented,
      },
    }],
    recommendedProductType: "Assurance vie",
    recommendedAmount,
    recommendedTerm: childrenCount > 0 || mortgage > 0 ? "Temporaire 20 ans à valider" : "Durée à confirmer",
    reasoning: "Le besoin net estime les dettes à protéger, le remplacement de revenu, les frais finaux, les études et les liquidités familiales, moins les protections et actifs liquides disponibles.",
    alternativesConsidered: [
      { label: "Protection minimale", amount: roundToNearest(netNeed * 0.75), note: "Réduit la prime, mais laisse possiblement un écart documenté." },
      { label: "Besoin net estimé", amount: recommendedAmount, note: "Couvre l’écart calculé selon les hypothèses actuelles." },
      { label: "Protection renforcée", amount: roundToNearest(netNeed * 1.15), note: "Ajoute une marge pour inflation, changements familiaux ou objectifs successoraux." },
    ],
    missingData,
  }
}

function calculateDisability(inputs: AnalysisInputMap, assumptions: AnalysisAssumptionMap): InsuranceCalculation {
  const annualIncome = money(inputs.annualIncome)
  const clientAge = integer(inputs.clientAge)
  const monthlyGrossIncome = money(inputs.monthlyGrossIncome, annualIncome > 0 ? annualIncome / 12 : 0)
  const monthlyNetIncome = money(inputs.monthlyNetIncome, monthlyGrossIncome * 0.68)
  const essentialExpenses = money(inputs.monthlyExpenses, monthlyNetIncome * 0.75)
  const housingPayment = money(inputs.housingPayment)
  const monthlyDebtPayments = money(inputs.monthlyDebtPayments)
  const existingIndividualBenefit = money(inputs.existingIndividualDisabilityBenefit)
  const groupCoveragePercentage = money(inputs.groupCoveragePercentage)
  const groupBenefitMaxMonthly = money(inputs.groupBenefitMaxMonthly)
  const calculatedGroupBenefit = groupCoveragePercentage > 0 ? monthlyGrossIncome * (groupCoveragePercentage / 100) : 0
  const groupBenefit = money(inputs.groupDisabilityBenefit, groupBenefitMaxMonthly > 0 ? Math.min(calculatedGroupBenefit, groupBenefitMaxMonthly) : calculatedGroupBenefit)
  const existingBenefitFromTotal = money(inputs.existingDisabilityBenefit)
  const groupBenefitTaxable = inputs.groupBenefitTaxable === true || inputs.groupBenefitTaxable === "true" || inputs.groupBenefitTaxable === "oui"
  const groupBenefitEstimatedNet = groupBenefitTaxable ? groupBenefit * 0.68 : groupBenefit
  const existingMonthlyBenefit = existingBenefitFromTotal || existingIndividualBenefit + groupBenefitEstimatedNet
  const emergencyMonths = money(inputs.emergencyFundMonths)
  const businessOverhead = money(inputs.businessOverhead)
  const dependentsCount = integer(inputs.dependentsCount, integer(inputs.childrenCount))
  const selfEmployed = inputs.selfEmployed === true || inputs.selfEmployed === "true" || inputs.selfEmployed === "oui"
  const waitingPeriodDays = integer(inputs.waitingPeriodDays)
  const benefitDurationMonths = integer(inputs.benefitDurationMonths)
  const emergencyMinimum = assumptionNumber(assumptions, "minimumEmergencyMonths", 3)
  const need = essentialExpenses + housingPayment + monthlyDebtPayments + businessOverhead
  const gap = Math.max(0, need - existingMonthlyBenefit)

  return {
    results: [{
      needCategory: "Invalidité",
      grossNeed: need,
      existingCoverage: existingMonthlyBenefit,
      availableAssetsOffset: 0,
      netNeed: gap,
      gapAmount: gap,
      calculationDetails: {
        monthlyGrossIncome,
        monthlyNetIncome,
        clientAge,
        essentialExpenses,
        housingPayment,
        monthlyDebtPayments,
        businessOverhead,
        dependentsCount,
        selfEmployed,
        existingIndividualBenefit,
        groupCoveragePercentage,
        groupBenefit,
        groupBenefitEstimatedNet,
        groupBenefitTaxable,
        groupBenefitMaxMonthly,
        waitingPeriodDays,
        benefitDurationMonths,
        emergencyMonths,
        emergencyMinimum,
      },
    }],
    recommendedProductType: "Assurance invalidité",
    recommendedAmount: roundToNearest(gap, 100),
    recommendedTerm: "Prestation mensuelle à valider selon admissibilité",
    reasoning: "Le calcul compare les dépenses essentielles et obligations mensuelles aux protections invalidité existantes.",
    alternativesConsidered: [
      { label: "Complément minimal", amount: roundToNearest(gap * 0.75, 100), note: "Réduit l’écart sans couvrir toute la pression mensuelle." },
      { label: "Écart mensuel estimé", amount: roundToNearest(gap, 100), note: "Vise à couvrir le manque mensuel estimé." },
      { label: "Protection avec marge", amount: roundToNearest(gap * 1.15, 100), note: "Ajoute une marge pour dépenses variables." },
    ],
    missingData: [
      !monthlyNetIncome ? "Revenu mensuel net" : null,
      existingMonthlyBenefit === 0 ? "Protection invalidité collective ou individuelle" : null,
      selfEmployed && businessOverhead === 0 ? "Frais généraux d’entreprise ou confirmation d’absence" : null,
      groupBenefit > 0 && !waitingPeriodDays ? "Délai de carence du régime collectif" : null,
      groupBenefit > 0 && !benefitDurationMonths ? "Durée de prestation du régime collectif" : null,
      emergencyMonths < emergencyMinimum ? "Fonds d’urgence à documenter" : null,
    ].filter(Boolean) as string[],
  }
}

function calculateCriticalIllness(inputs: AnalysisInputMap, assumptions: AnalysisAssumptionMap): InsuranceCalculation {
  const mortgage = money(inputs.mortgageBalance)
  const liquidAssets = money(inputs.liquidAssets)
  const existingCoverage = money(inputs.existingCriticalIllnessCoverage)
  const mortgagePortion = money(inputs.mortgageProtectionGoal, Math.min(mortgage, assumptionNumber(assumptions, "mortgageProtectionPortion", 150000)))
  const medicalLiquidity = money(inputs.medicalLiquidityNeed, assumptionNumber(assumptions, "medicalLiquidity", 50000))
  const incomeMonths = assumptionNumber(assumptions, "incomeReplacementMonths", 12)
  const annualIncome = money(inputs.annualIncome)
  const disabilityCoverageAvailable = money(inputs.disabilityCoverageAvailable)
  const emergencyMonths = money(inputs.emergencyFundMonths)
  const familySupportNeed = money(inputs.familySupportNeed, assumptionNumber(assumptions, "familyReserve", 25000))
  const homeAdaptationNeed = money(inputs.homeAdaptationNeed)
  const dependentsCount = integer(inputs.dependentsCount, integer(inputs.childrenCount))
  const selfEmployed = inputs.selfEmployed === true || inputs.selfEmployed === "true" || inputs.selfEmployed === "oui"
  const policyDocumented = inputs.criticalIllnessPolicyDocumented === true || inputs.criticalIllnessPolicyDocumented === "true" || inputs.criticalIllnessPolicyDocumented === "oui"
  const incomeReplacement = annualIncome / 12 * incomeMonths
  const grossNeed = mortgagePortion + medicalLiquidity + incomeReplacement + familySupportNeed + homeAdaptationNeed
  const netNeed = Math.max(0, grossNeed - existingCoverage - liquidAssets * 0.25)

  return {
    results: [{
      needCategory: "Maladies graves",
      grossNeed,
      existingCoverage,
      availableAssetsOffset: liquidAssets * 0.25,
      netNeed,
      gapAmount: netNeed,
      calculationDetails: {
        mortgage,
        mortgagePortion,
        medicalLiquidity,
        incomeReplacement,
        incomeMonths,
        familySupportNeed,
        homeAdaptationNeed,
        dependentsCount,
        selfEmployed,
        disabilityCoverageAvailable,
        emergencyMonths,
        existingCoverage,
        policyDocumented,
      },
    }],
    recommendedProductType: "Assurance maladies graves",
    recommendedAmount: roundToNearest(netNeed),
    recommendedTerm: "Montant forfaitaire à valider",
    reasoning: "Le besoin vise des liquidités en cas de diagnostic grave: dette, frais médicaux, adaptation et remplacement temporaire de revenu.",
    alternativesConsidered: [
      { label: "Liquidité de base", amount: roundToNearest(netNeed * 0.7), note: "Priorise les liquidités immédiates." },
      { label: "Besoin estimé", amount: roundToNearest(netNeed), note: "Couvre l’écart calculé." },
      { label: "Scénario hypothèque", amount: roundToNearest(Math.max(netNeed, mortgagePortion)), note: "Met l’accent sur la dette familiale." },
    ],
    missingData: [
      !annualIncome ? "Revenu annuel" : null,
      existingCoverage === 0 ? "Protection maladies graves existante ou confirmation d’absence" : null,
      existingCoverage > 0 && !policyDocumented ? "Document de police maladies graves" : null,
      disabilityCoverageAvailable === 0 ? "Protection invalidité à comparer" : null,
    ].filter(Boolean) as string[],
  }
}

function calculateBusiness(inputs: AnalysisInputMap, assumptions: AnalysisAssumptionMap): InsuranceCalculation {
  const businessValue = money(inputs.businessValue)
  const ownershipPercentage = money(inputs.ownershipPercentage, 100) / 100
  const corporateDebt = money(inputs.corporateDebt)
  const personalGuaranteesAmount = money(inputs.personalGuaranteesAmount)
  const existingCorporateCoverage = money(inputs.existingCorporateCoverage)
  const operatingMonths = assumptionNumber(assumptions, "continuityMonths", 6)
  const monthlyOperatingNeed = money(inputs.monthlyOperatingNeed)
  const keyPersonRevenueImpact = money(inputs.keyPersonRevenueImpact)
  const keyPersonReplacementCost = money(inputs.keyPersonReplacementCost)
  const keyPersonTransitionCost = money(inputs.keyPersonTransitionCost)
  const shareholderCount = integer(inputs.shareholderCount)
  const previousShareholderCount = integer(inputs.previousShareholderCount)
  const previousOwnershipPercentage = money(inputs.previousOwnershipPercentage)
  const shareholdersChangedSinceLastReview = inputs.shareholdersChangedSinceLastReview === true || inputs.shareholdersChangedSinceLastReview === "true" || inputs.shareholdersChangedSinceLastReview === "oui"
  const hasShareholdersAgreement = inputs.hasShareholdersAgreement === true || inputs.hasShareholdersAgreement === "true" || inputs.hasShareholdersAgreement === "oui"
  const shareholdersAgreementUpdated = inputs.shareholdersAgreementUpdated === true || inputs.shareholdersAgreementUpdated === "true" || inputs.shareholdersAgreementUpdated === "oui"
  const agreementFunded = inputs.agreementFunded === true || inputs.agreementFunded === "true" || inputs.agreementFunded === "oui"
  const policyOwnedByCorrectEntity = inputs.policyOwnedByCorrectEntity === true || inputs.policyOwnedByCorrectEntity === "true" || inputs.policyOwnedByCorrectEntity === "oui"
  const beneficiaryStructureReviewed = inputs.beneficiaryStructureReviewed === true || inputs.beneficiaryStructureReviewed === "true" || inputs.beneficiaryStructureReviewed === "oui"
  const ownershipChanged = shareholdersChangedSinceLastReview
    || (previousShareholderCount > 0 && shareholderCount > 0 && previousShareholderCount !== shareholderCount)
    || (previousOwnershipPercentage > 0 && ownershipPercentage > 0 && Math.abs(previousOwnershipPercentage / 100 - ownershipPercentage) >= 0.01)
  const keyPersonNeed = keyPersonRevenueImpact + keyPersonReplacementCost + keyPersonTransitionCost
  const buySellNeed = businessValue * ownershipPercentage
  const continuityNeed = operatingMonths * monthlyOperatingNeed
  const grossNeed = keyPersonNeed + buySellNeed + corporateDebt + personalGuaranteesAmount + continuityNeed
  const netNeed = Math.max(0, grossNeed - existingCorporateCoverage)

  return {
    results: [{
      needCategory: "Assurance entreprise",
      grossNeed,
      existingCoverage: existingCorporateCoverage,
      availableAssetsOffset: 0,
      netNeed,
      gapAmount: netNeed,
      calculationDetails: {
        keyPersonNeed,
        keyPersonRevenueImpact,
        keyPersonReplacementCost,
        keyPersonTransitionCost,
        buySellNeed,
        businessValue,
        ownershipPercentage,
        shareholderCount,
        previousShareholderCount,
        previousOwnershipPercentage,
        shareholdersChangedSinceLastReview,
        ownershipChanged,
        hasShareholdersAgreement,
        shareholdersAgreementUpdated,
        agreementFunded,
        corporateDebt,
        personalGuaranteesAmount,
        continuityNeed,
        monthlyOperatingNeed,
        operatingMonths,
        policyOwnedByCorrectEntity,
        beneficiaryStructureReviewed,
      },
    }],
    recommendedProductType: "Assurance entreprise",
    recommendedAmount: roundToNearest(netNeed),
    recommendedTerm: "Personne clé / rachat de parts / dette à structurer",
    reasoning: "Le calcul estime la protection des parts, des dettes commerciales et de la continuité d’exploitation.",
    alternativesConsidered: [
      { label: "Dette commerciale", amount: roundToNearest(corporateDebt), note: "Couvre seulement les obligations commerciales connues." },
      { label: "Rachat de parts", amount: roundToNearest(buySellNeed), note: "Vise la valeur de participation." },
      { label: "Protection complète", amount: roundToNearest(netNeed), note: "Combine parts, dette et continuité." },
    ],
    missingData: [
      !businessValue ? "Valeur estimée de l’entreprise" : null,
      !ownershipPercentage ? "Pourcentage de détention" : null,
      shareholderCount > 1 && !hasShareholdersAgreement ? "Convention entre actionnaires" : null,
      ownershipChanged && !shareholdersAgreementUpdated ? "Convention et polices à revoir après changement d’actionnariat" : null,
      hasShareholdersAgreement && !agreementFunded ? "Financement de la convention entre actionnaires" : null,
      corporateDebt === 0 ? "Dettes commerciales ou confirmation d’absence" : null,
      personalGuaranteesAmount === 0 ? "Garanties personnelles ou confirmation d’absence" : null,
      keyPersonNeed === 0 ? "Besoin personne clé ou confirmation d’absence" : null,
      existingCorporateCoverage > 0 && !policyOwnedByCorrectEntity ? "Titulaire de police corporative validé" : null,
      existingCorporateCoverage > 0 && !beneficiaryStructureReviewed ? "Bénéficiaire corporatif validé" : null,
    ].filter(Boolean) as string[],
  }
}

function calculateReplacement(inputs: AnalysisInputMap): InsuranceCalculation {
  const existingPremium = money(inputs.existingPremium)
  const proposedPremium = money(inputs.proposedPremium)
  const existingCoverage = money(inputs.existingCoverage)
  const proposedCoverage = money(inputs.proposedCoverage)
  const replacementRequired = inputs.replacementRequired === true || inputs.replacementRequired === "true" || inputs.replacementRequired === "oui"
  const noticeCompleted = inputs.replacementNoticeCompleted === true || inputs.replacementNoticeCompleted === "true" || inputs.replacementNoticeCompleted === "oui"
  const comparisonExplained = inputs.replacementComparisonExplained === true || inputs.replacementComparisonExplained === "true" || inputs.replacementComparisonExplained === "oui"
  const clientAcknowledged = inputs.replacementClientAcknowledged === true || inputs.replacementClientAcknowledged === "true" || inputs.replacementClientAcknowledged === "oui"
  const lostBenefits = String(inputs.lostBenefits ?? "").trim()
  const newExclusions = String(inputs.newExclusions ?? "").trim()
  const advantages = String(inputs.replacementAdvantages ?? "").trim()
  const disadvantages = String(inputs.replacementDisadvantages ?? "").trim()
  const justification = String(inputs.replacementJustification ?? "").trim()
  const existingPolicyNumber = String(inputs.existingPolicyNumber ?? "").trim()
  const proposedPolicyNumber = String(inputs.proposedPolicyNumber ?? "").trim()
  const existingIssueDate = String(inputs.existingIssueDate ?? "").trim()
  const proposedIssueDate = String(inputs.proposedIssueDate ?? "").trim()
  const existingRiders = String(inputs.existingRiders ?? "").trim()
  const proposedRiders = String(inputs.proposedRiders ?? "").trim()
  const existingPremiumGuarantee = String(inputs.existingPremiumGuarantee ?? "").trim()
  const proposedPremiumGuarantee = String(inputs.proposedPremiumGuarantee ?? "").trim()
  const existingContestabilityPeriod = String(inputs.existingContestabilityPeriod ?? "").trim()
  const proposedContestabilityPeriod = String(inputs.proposedContestabilityPeriod ?? "").trim()
  const existingFeesOrSurrenderCharges = String(inputs.existingFeesOrSurrenderCharges ?? "").trim()
  const proposedFeesOrCharges = String(inputs.proposedFeesOrCharges ?? "").trim()
  const existingOwner = String(inputs.existingOwner ?? "").trim()
  const proposedOwner = String(inputs.proposedOwner ?? "").trim()
  const existingBeneficiaries = String(inputs.existingBeneficiaries ?? "").trim()
  const proposedBeneficiaries = String(inputs.proposedBeneficiaries ?? "").trim()
  const underwritingRisks = String(inputs.underwritingRisks ?? "").trim()
  const cashValueSurrendered = money(inputs.cashValueSurrendered)
  const premiumDifference = proposedPremium - existingPremium

  return {
    results: [{
      needCategory: "Remplacement de contrat",
      grossNeed: proposedCoverage,
      existingCoverage,
      availableAssetsOffset: 0,
      netNeed: Math.max(0, proposedCoverage - existingCoverage),
      gapAmount: Math.max(0, proposedCoverage - existingCoverage),
      calculationDetails: {
        existingPremium,
        proposedPremium,
        premiumDifference,
        existingCoverage,
        proposedCoverage,
        replacementRequired,
        noticeCompleted,
        comparisonExplained,
        clientAcknowledged,
        cashValueSurrendered,
        existingPolicyNumber,
        proposedPolicyNumber,
        existingIssueDate,
        proposedIssueDate,
        existingRiders,
        proposedRiders,
        existingPremiumGuarantee,
        proposedPremiumGuarantee,
        existingContestabilityPeriod,
        proposedContestabilityPeriod,
        existingFeesOrSurrenderCharges,
        proposedFeesOrCharges,
        existingOwner,
        proposedOwner,
        existingBeneficiaries,
        proposedBeneficiaries,
        underwritingRisks,
        advantages,
        disadvantages,
        lostBenefits,
        newExclusions,
        justification,
      },
    }],
    recommendedProductType: "Analyse de remplacement",
    recommendedAmount: proposedCoverage,
    recommendedTerm: "Comparaison obligatoire avant recommandation",
    reasoning: "Le remplacement doit être justifié dans l’intérêt du client et documenter avantages, désavantages, garanties perdues et préavis requis.",
    alternativesConsidered: [
      { label: "Maintien du contrat actuel", amount: existingCoverage, note: "Option à favoriser si le remplacement n’est pas clairement justifié." },
      { label: "Nouveau contrat proposé", amount: proposedCoverage, note: "À justifier avec comparaison complète." },
    ],
    missingData: [
      !existingCoverage ? "Montant assuré du contrat existant" : null,
      !proposedCoverage ? "Montant proposé" : null,
      !existingPremium ? "Prime actuelle" : null,
      !proposedPremium ? "Prime proposée" : null,
      !existingPolicyNumber ? "Numéro du contrat existant" : null,
      !existingIssueDate ? "Date d’émission du contrat existant" : null,
      !proposedIssueDate ? "Date d’émission ou date prévue du nouveau contrat" : null,
      !existingRiders ? "Avenants du contrat existant ou confirmation d’absence" : null,
      !proposedRiders ? "Avenants du contrat proposé ou confirmation d’absence" : null,
      !existingPremiumGuarantee ? "Garantie de prime du contrat existant" : null,
      !proposedPremiumGuarantee ? "Garantie de prime du contrat proposé" : null,
      !existingContestabilityPeriod ? "Période de contestabilité du contrat existant" : null,
      !proposedContestabilityPeriod ? "Nouvelle période de contestabilité" : null,
      !existingFeesOrSurrenderCharges ? "Frais, pertes ou charges de rachat du contrat existant" : null,
      !proposedFeesOrCharges ? "Frais ou charges du contrat proposé" : null,
      !existingOwner ? "Titulaire du contrat existant" : null,
      !proposedOwner ? "Titulaire du contrat proposé" : null,
      !existingBeneficiaries ? "Bénéficiaires détaillés du contrat existant" : null,
      !proposedBeneficiaries ? "Bénéficiaires détaillés du contrat proposé" : null,
      !underwritingRisks ? "Risques de souscription et conséquences de remplacement" : null,
      !advantages ? "Avantages du nouveau contrat" : null,
      !disadvantages ? "Désavantages du remplacement" : null,
      !lostBenefits ? "Garanties ou bénéfices perdus" : null,
      !newExclusions ? "Nouvelles exclusions ou restrictions" : null,
      replacementRequired && !justification ? "Justification écrite du remplacement" : null,
      replacementRequired && !noticeCompleted ? "Préavis de remplacement complété" : null,
      replacementRequired && !comparisonExplained ? "Comparaison expliquée au client" : null,
      replacementRequired && !clientAcknowledged ? "Reconnaissance client du remplacement" : null,
    ].filter(Boolean) as string[],
  }
}
