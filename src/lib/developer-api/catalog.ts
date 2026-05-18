import type { SubscriptionPlanKey } from "@/lib/billing/plans"

export const developerApiPermissions = {
  "contacts:read": "Lire les contacts",
  "contacts:create": "Créer des contacts",
  "contacts:update": "Modifier les contacts",
  "contacts:delete": "Archiver des contacts",
  "deals:read": "Lire les opportunités",
  "deals:create": "Créer une opportunité",
  "deals:update": "Modifier une opportunité",
  "deals:move": "Changer une opportunité d’étape",
  "tasks:read": "Lire les tâches",
  "tasks:create": "Créer une tâche",
  "tasks:update": "Modifier une tâche",
  "tasks:complete": "Marquer une tâche comme terminée",
  "appointments:read": "Lire les rendez-vous",
  "appointments:create": "Créer un rendez-vous",
  "appointments:update": "Modifier un rendez-vous",
  "appointments:cancel": "Annuler un rendez-vous",
  "campaigns:read": "Lire les campagnes",
  "campaigns:create": "Créer une campagne",
  "campaigns:subscribe": "Ajouter un contact à une campagne",
  "campaigns:unsubscribe": "Retirer un contact d’une campagne",
  "emails:send": "Envoyer un email via le CRM",
  "documents:read": "Lire les métadonnées documentaires",
  "documents:upload": "Ajouter un document",
  "documents:request": "Demander un document",
  "documents:delete": "Archiver un document",
  "webhooks:read": "Lire les webhooks",
  "webhooks:create": "Créer un webhook",
  "webhooks:update": "Modifier un webhook",
  "webhooks:delete": "Supprimer un webhook",
} as const

export type DeveloperApiPermission = keyof typeof developerApiPermissions

export const permissionGroups = [
  {
    label: "Contacts",
    permissions: ["contacts:read", "contacts:create", "contacts:update", "contacts:delete"],
  },
  {
    label: "Opportunités",
    permissions: ["deals:read", "deals:create", "deals:update", "deals:move"],
  },
  {
    label: "Tâches",
    permissions: ["tasks:read", "tasks:create", "tasks:update", "tasks:complete"],
  },
  {
    label: "Rendez-vous",
    permissions: ["appointments:read", "appointments:create", "appointments:update", "appointments:cancel"],
  },
  {
    label: "Marketing",
    permissions: ["campaigns:read", "campaigns:create", "campaigns:subscribe", "campaigns:unsubscribe", "emails:send"],
  },
  {
    label: "Documents",
    permissions: ["documents:read", "documents:upload", "documents:request", "documents:delete"],
  },
  {
    label: "Webhooks",
    permissions: ["webhooks:read", "webhooks:create", "webhooks:update", "webhooks:delete"],
  },
] satisfies Array<{ label: string; permissions: DeveloperApiPermission[] }>

export const webhookEventLabels = {
  "contact.created": "Contact créé",
  "contact.updated": "Contact modifié",
  "deal.created": "Opportunité créée",
  "deal.stage_changed": "Étape d’opportunité modifiée",
  "task.created": "Tâche créée",
  "task.completed": "Tâche terminée",
  "appointment.created": "Rendez-vous créé",
  "document.requested": "Document demandé",
  "document.uploaded": "Document reçu",
  "webhook.created": "Webhook créé",
  "email.opened": "Email ouvert",
} as const

export type WebhookEventKey = keyof typeof webhookEventLabels

export const quotaLimitsByPlan: Record<SubscriptionPlanKey, { apiCalls: number; webhookDeliveries: number; activeApiKeys: number; activeWebhooks: number; logRetentionDays: number; sandbox: boolean }> = {
  ESSENTIEL: { apiCalls: 5_000, webhookDeliveries: 1_000, activeApiKeys: 1, activeWebhooks: 1, logRetentionDays: 7, sandbox: false },
  CROISSANCE: { apiCalls: 50_000, webhookDeliveries: 20_000, activeApiKeys: 5, activeWebhooks: 5, logRetentionDays: 30, sandbox: true },
  CABINET: { apiCalls: 250_000, webhookDeliveries: 100_000, activeApiKeys: 20, activeWebhooks: 20, logRetentionDays: 90, sandbox: true },
  RESEAU: { apiCalls: 250_000, webhookDeliveries: 100_000, activeApiKeys: 20, activeWebhooks: 20, logRetentionDays: 90, sandbox: true },
}
