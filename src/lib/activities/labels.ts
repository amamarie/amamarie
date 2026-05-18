import type { ActivityType } from "@prisma/client"

export type ActivityCategory =
  | "prospect"
  | "client"
  | "task"
  | "note"
  | "document"
  | "product"
  | "communication"
  | "automation"
  | "alert"
  | "compliance"
  | "ai"
  | "other"

export const activitySourceLabels: Record<string, string> = {
  USER: "Manuel",
  AUTOMATION: "Automatisation",
  SYSTEM: "Système",
  AI: "IA",
  WEBHOOK: "Système connecté",
  IMPORT: "Import",
}

export function getActivityTypeLabel(type: ActivityType | string) {
  const labels: Partial<Record<ActivityType, string>> = {
    LEAD_CREATED: "Prospect créé",
    LEAD_UPDATED: "Prospect modifié",
    LEAD_STATUS_CHANGED: "Statut prospect modifié",
    LEAD_ARCHIVED: "Prospect archivé",
    LEAD_CONVERTED: "Prospect converti",
    LEAD_LOST: "Prospect perdu",
    LEAD_ASSIGNED: "Prospect assigné",
    CLIENT_CREATED: "Client créé",
    CLIENT_UPDATED: "Client modifié",
    CLIENT_ARCHIVED: "Client archivé",
    CLIENT_STATUS_CHANGED: "Statut client modifié",
    CLIENT_ASSIGNED: "Client assigné",
    TASK_CREATED: "Tâche créée",
    TASK_UPDATED: "Tâche modifiée",
    TASK_COMPLETED: "Tâche terminée",
    TASK_CANCELLED: "Tâche annulée",
    TASK_SNOOZED: "Tâche reportée",
    TASK_REOPENED: "Tâche réouverte",
    TASK_ASSIGNED: "Tâche assignée",
    TASK_PRIORITY_CHANGED: "Priorité modifiée",
    TASK_OVERDUE: "Tâche en retard",
    TASK_REMINDER_SENT: "Rappel envoyé",
    DOCUMENT_ADDED: "Document ajouté",
    DOCUMENT_UPLOADED: "Document téléversé",
    DOCUMENT_UPDATED: "Document modifié",
    DOCUMENT_STATUS_CHANGED: "Statut document modifié",
    DOCUMENT_RECEIVED: "Document reçu",
    DOCUMENT_VALIDATED: "Document validé",
    DOCUMENT_REJECTED: "Document rejeté",
    DOCUMENT_WAIVED: "Document exempté",
    DOCUMENT_EXPIRED: "Document expiré",
    DOCUMENT_ARCHIVED: "Document archivé",
    DOCUMENT_RESTORED: "Document restauré",
    NOTE_ADDED: "Note ajoutée",
    NOTE_UPDATED: "Note modifiée",
    NOTE_PINNED: "Note épinglée",
    NOTE_UNPINNED: "Note désépinglée",
    NOTE_ARCHIVED: "Note archivée",
    NOTE_RESTORED: "Note restaurée",
    NOTE_DELETED: "Note supprimée",
    PRODUCT_CREATED: "Produit ajouté",
    PRODUCT_UPDATED: "Produit modifié",
    PRODUCT_STATUS_CHANGED: "Statut produit modifié",
    PRODUCT_REVIEWED: "Produit révisé",
    PRODUCT_ARCHIVED: "Produit archivé",
    PRODUCT_DOCUMENT_LINKED: "Document lié au produit",
    CALL_RECEIVED: "Appel reçu",
    CALL_MADE: "Appel effectué",
    CALL_MISSED: "Appel manqué",
    SMS_SENT: "SMS envoyé",
    SMS_RECEIVED: "SMS reçu",
    EMAIL_SENT: "Courriel envoyé",
    EMAIL_RECEIVED: "Courriel reçu",
    AUTOMATION_EXECUTED: "Automatisation exécutée",
    AUTOMATION_FAILED: "Automatisation échouée",
    ALERT_CREATED: "Alerte créée",
    ALERT_RESOLVED: "Alerte résolue",
    ALERT_DISMISSED: "Alerte ignorée",
    KYC_CREATED: "Profil client créé",
    KYC_UPDATED: "Profil client modifié",
    KYC_APPROVED: "Profil client approuvé",
    KYC_REJECTED: "Profil client rejeté",
    CONSENT_GIVEN: "Consentement donné",
    CONSENT_REVOKED: "Consentement révoqué",
    COMPLIANCE_ALERT_CREATED: "Alerte conformité créée",
    COMPLIANCE_ALERT_RESOLVED: "Alerte conformité résolue",
    COMPLIANCE_ALERT_DISMISSED: "Alerte conformité ignorée",
    AI_ALERT_EXPLANATION_GENERATED: "Explication IA générée",
    AI_ALERT_TASK_CREATED: "Tâche IA créée",
    AI_ALERT_NOTE_CREATED: "Note IA créée",
  }

  return labels[type as ActivityType] ?? type.replaceAll("_", " ").toLowerCase()
}

export function getActivityCategory(type: ActivityType | string): ActivityCategory {
  if (type.startsWith("LEAD_")) return "prospect"
  if (type.startsWith("CLIENT_")) return "client"
  if (type.startsWith("TASK_")) return "task"
  if (type.startsWith("NOTE_")) return "note"
  if (type.startsWith("DOCUMENT_")) return "document"
  if (type.startsWith("PRODUCT_")) return "product"
  if (type.startsWith("CALL_") || type.startsWith("SMS_") || type.startsWith("EMAIL_")) return "communication"
  if (type.startsWith("AUTOMATION_")) return "automation"
  if (type.startsWith("ALERT_")) return "alert"
  if (type.startsWith("KYC_") || type.startsWith("CONSENT_") || type.startsWith("COMPLIANCE_")) return "compliance"
  if (type.startsWith("AI_")) return "ai"
  return "other"
}
