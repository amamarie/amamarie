export const documentTypeLabels: Record<string, string> = {
  GOVERNMENT_ID: "Pièce d’identité",
  PROOF_OF_ADDRESS: "Preuve d’adresse",
  VOID_CHEQUE: "Spécimen de chèque",
  KYC_FORM: "Formulaire profil client",
  RISK_PROFILE: "Profil de risque",
  CONSENT_FORM: "Consentement",
  POLICY_DOCUMENT: "Police / contrat",
  PROPOSAL: "Proposition",
  ILLUSTRATION: "Illustration",
  INVESTMENT_STATEMENT: "Relevé de placement",
  INSURANCE_STATEMENT: "Relevé d’assurance",
  BENEFICIARY_FORM: "Formulaire bénéficiaire",
  SIGNATURE_PAGE: "Page de signature",
  TAX_DOCUMENT: "Document fiscal",
  CLIENT_NOTE: "Note client exportée",
  OTHER: "Autre",
}

export const documentStatusLabels: Record<string, string> = {
  REQUIRED: "Requis",
  REQUESTED: "Demandé",
  RECEIVED: "Reçu",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  EXPIRED: "Expiré",
  WAIVED: "Exempté",
  ARCHIVED: "Archivé",
}

export const documentVisibilityLabels: Record<string, string> = {
  INTERNAL: "Interne",
  TEAM: "Équipe",
  CLIENT_VISIBLE: "Visible client",
  COMPLIANCE_ONLY: "Conformité seulement",
}
