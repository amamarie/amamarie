import type { DeveloperApiPermission, WebhookEventKey } from "@/lib/developer-api/catalog"

export type DeveloperEndpointReference = {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  path: string
  title: string
  permission: DeveloperApiPermission | "OAuth 2.0"
  description: string
  useCase: string
  requestExample?: Record<string, unknown>
  responseExample: Record<string, unknown>
  errors: Array<{ code: number; label: string }>
  copyCurl: string
}

export const developerEndpointReference: DeveloperEndpointReference[] = [
  {
    method: "POST",
    path: "/api/v1/contacts",
    title: "Créer un contact",
    permission: "contacts:create",
    description: "Crée un prospect ou client dans le CRM depuis un formulaire, un back-office ou une automatisation.",
    useCase: "Capturer un lead depuis un site web.",
    requestExample: {
      first_name: "Jean",
      last_name: "Martin",
      email: "jean.martin@example.com",
      phone: "+33612345678",
      status: "prospect",
      source: "site_web",
      tags: ["retraite", "prospect_chaud"],
      marketing_consent: true,
    },
    responseExample: {
      id: "contact_01HX9M7YQK",
      first_name: "Jean",
      last_name: "Martin",
      email: "jean.martin@example.com",
      status: "prospect",
      created_at: "2026-05-15T14:22:00Z",
    },
    errors: [
      { code: 400, label: "Données invalides" },
      { code: 401, label: "Clé API manquante ou invalide" },
      { code: 403, label: "Permission insuffisante" },
      { code: 409, label: "Contact déjà existant" },
      { code: 429, label: "Limite API dépassée" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/contacts" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"first_name":"Jean","last_name":"Martin","email":"jean.martin@example.com","source":"site_web"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/deals",
    title: "Créer une opportunité",
    permission: "deals:create",
    description: "Crée une opportunité commerciale rattachée à un contact existant.",
    useCase: "Ouvrir automatiquement un projet PER, assurance vie ou prévoyance après un formulaire.",
    requestExample: {
      contact_id: "contact_01HX9M7YQK",
      title: "Projet PER",
      product_type: "per",
      amount: 2500,
      stage: "besoin_identifie",
      expected_close_date: "2026-06-15",
      owner_id: "user_123",
    },
    responseExample: {
      id: "deal_01HX9NB4M2",
      title: "Projet PER",
      stage: "besoin_identifie",
      amount: 2500,
      created_at: "2026-05-15T14:30:00Z",
    },
    errors: [
      { code: 400, label: "Données invalides" },
      { code: 401, label: "Clé API invalide" },
      { code: 403, label: "Permission deals:create requise" },
      { code: 422, label: "Contact introuvable ou champ manquant" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/deals" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"contact_id":"contact_01HX9M7YQK","title":"Projet PER","amount":2500}'`,
  },
  {
    method: "POST",
    path: "/api/v1/tasks",
    title: "Créer une tâche",
    permission: "tasks:create",
    description: "Crée une tâche de relance assignée à un conseiller ou assistant.",
    useCase: "Déclencher une relance après devis, rendez-vous ou document reçu.",
    requestExample: {
      contact_id: "contact_01HX9M7YQK",
      title: "Relancer Jean Martin",
      description: "Relance suite au formulaire retraite",
      due_date: "2026-05-20",
      priority: "high",
      assigned_to: "user_123",
    },
    responseExample: {
      id: "task_01HX9M8AB3",
      title: "Relancer Jean Martin",
      status: "TODO",
      created_at: "2026-05-15T14:31:00Z",
    },
    errors: [
      { code: 400, label: "Données invalides" },
      { code: 403, label: "Permission tasks:create requise" },
      { code: 422, label: "Date ou assignation invalide" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/tasks" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"contact_id":"contact_01HX9M7YQK","title":"Relancer Jean Martin","priority":"high"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/appointments",
    title: "Créer un rendez-vous",
    permission: "appointments:create",
    description: "Crée un rendez-vous API ou sandbox avec date de début, date de fin, lieu et conseiller assigné.",
    useCase: "Synchroniser un calendrier externe ou un formulaire de réservation.",
    requestExample: {
      contact_id: "contact_01HX9M7YQK",
      title: "Bilan retraite",
      starts_at: "2026-05-22T09:00:00Z",
      ends_at: "2026-05-22T09:45:00Z",
      location: "Google Meet",
      assigned_to: "user_123",
    },
    responseExample: {
      id: "appointment_01HX9Q4R2B",
      title: "Bilan retraite",
      status: "scheduled",
      created_at: "2026-05-15T14:35:00Z",
    },
    errors: [
      { code: 400, label: "Dates invalides" },
      { code: 403, label: "Permission appointments:create requise" },
      { code: 422, label: "Contact ou conseiller introuvable" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/appointments" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"contact_id":"contact_01HX9M7YQK","title":"Bilan retraite","starts_at":"2026-05-22T09:00:00Z","ends_at":"2026-05-22T09:45:00Z"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/campaigns",
    title: "Créer une campagne",
    permission: "campaigns:create",
    description: "Crée une campagne marketing API ou sandbox.",
    useCase: "Préparer une séquence retraite, prévoyance ou suivi client depuis un outil marketing.",
    requestExample: {
      name: "Campagne retraite",
      topic: "retraite",
      description: "Séquence de suivi pour prospects retraite",
    },
    responseExample: {
      id: "campaign_01HX9R1K2D",
      name: "Campagne retraite",
      status: "draft",
    },
    errors: [
      { code: 400, label: "Nom manquant" },
      { code: 403, label: "Permission campaigns:create requise" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/campaigns" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Campagne retraite","topic":"retraite"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/campaigns/{campaignId}/subscribers",
    title: "Ajouter un contact à une campagne",
    permission: "campaigns:subscribe",
    description: "Ajoute un contact consentant à une campagne marketing.",
    useCase: "Inscrire automatiquement un prospect à une séquence après consentement.",
    requestExample: {
      contact_id: "contact_01HX9M7YQK",
      consent_confirmed: true,
    },
    responseExample: {
      id: "subscriber_01HX9R6Z2P",
      status: "subscribed",
      consent_confirmed: true,
    },
    errors: [
      { code: 403, label: "Permission campaigns:subscribe requise" },
      { code: 409, label: "Contact déjà abonné" },
      { code: 422, label: "Consentement requis" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/campaigns/campaign_123/subscribers" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"contact_id":"contact_01HX9M7YQK","consent_confirmed":true}'`,
  },
  {
    method: "POST",
    path: "/api/v1/documents",
    title: "Demander un document",
    permission: "documents:request",
    description: "Crée une demande documentaire ou un document API lié à un contact.",
    useCase: "Demander une pièce d’identité, un avis d’imposition ou un justificatif à un client.",
    requestExample: {
      contact_id: "contact_01HX9M7YQK",
      document_type: "identity_card",
      message: "Merci de transmettre une pièce d’identité à jour.",
    },
    responseExample: {
      id: "document_request_01HX9R8A1K",
      status: "requested",
    },
    errors: [
      { code: 403, label: "Permission documents:request requise" },
      { code: 422, label: "Contact ou type de document manquant" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/documents" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"contact_id":"contact_01HX9M7YQK","document_type":"identity_card"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/webhooks",
    title: "Créer un webhook",
    permission: "webhooks:create",
    description: "Crée une destination webhook HTTPS avec secret signé.",
    useCase: "Connecter Make, Zapier, n8n ou un back-office aux événements CRM.",
    requestExample: {
      name: "Make leads",
      url: "https://hook.make.com/xxxxx",
      events: ["contact.created", "deal.stage_changed"],
      environment: "production",
    },
    responseExample: {
      id: "webhook_01HX9S1M7F",
      status: "active",
      secret: "whsec_xxxxxxxxx",
    },
    errors: [
      { code: 400, label: "URL HTTPS requise" },
      { code: 403, label: "Permission webhooks:create requise" },
      { code: 429, label: "Limite de webhooks actifs atteinte" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/v1/webhooks" \\
  -H "Authorization: Bearer sk_live_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Make leads","url":"https://hook.make.com/xxxxx","events":["contact.created"]}'`,
  },
  {
    method: "POST",
    path: "/api/oauth/token",
    title: "Obtenir un jeton OAuth",
    permission: "OAuth 2.0",
    description: "Échange un client_id et un client_secret contre un jeton Bearer valable 1 heure.",
    useCase: "Brancher un portail partenaire public avec client_credentials.",
    requestExample: {
      grant_type: "client_credentials",
      client_id: "oauth_client_xxxxx",
      client_secret: "oauth_secret_xxxxx",
    },
    responseExample: {
      access_token: "oauth_xxxxxxxxx",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "contacts:read contacts:create",
    },
    errors: [
      { code: 400, label: "grant_type invalide" },
      { code: 401, label: "client_id ou client_secret invalide" },
    ],
    copyCurl: `curl -X POST "https://api.finassuro.com/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=oauth_client_xxxxx&client_secret=oauth_secret_xxxxx"`,
  },
]

export const developerWebhookReference: Array<{ event: WebhookEventKey; label: string; trigger: string }> = [
  { event: "contact.created", label: "Contact créé", trigger: "Nouveau prospect ou client créé" },
  { event: "contact.updated", label: "Contact modifié", trigger: "Coordonnées, statut ou source modifiés" },
  { event: "deal.created", label: "Opportunité créée", trigger: "Nouveau projet commercial ouvert" },
  { event: "deal.stage_changed", label: "Étape d’opportunité modifiée", trigger: "Changement d’étape dans le pipeline" },
  { event: "task.created", label: "Tâche créée", trigger: "Relance ou action créée" },
  { event: "task.completed", label: "Tâche terminée", trigger: "Action marquée comme terminée" },
  { event: "appointment.created", label: "Rendez-vous créé", trigger: "Rendez-vous ou bilan créé" },
  { event: "document.requested", label: "Document demandé", trigger: "Demande documentaire envoyée" },
  { event: "document.uploaded", label: "Document reçu", trigger: "Document ajouté ou validé" },
  { event: "email.opened", label: "Email ouvert", trigger: "Ouverture marketing détectée" },
]

export const developerErrorReference = [
  { code: "invalid_api_key", message: "Clé API invalide" },
  { code: "permission_denied", message: "Permission insuffisante" },
  { code: "contact_already_exists", message: "Contact déjà existant" },
  { code: "invalid_email", message: "Adresse email invalide" },
  { code: "missing_required_field", message: "Champ obligatoire manquant" },
  { code: "rate_limit_exceeded", message: "Limite d’appels dépassée" },
  { code: "webhook_delivery_failed", message: "Envoi webhook échoué" },
  { code: "sandbox_only", message: "Action disponible seulement en sandbox" },
]

export const developerChangelog = [
  { date: "2026-05-15", version: "v1.3", change: "Ajout des endpoints documents, campagnes, rendez-vous et webhooks." },
  { date: "2026-05-01", version: "v1.2", change: "Ajout des webhooks signés et du retry en 6 tentatives." },
  { date: "2026-04-15", version: "v1.1", change: "Ajout pagination, filtres, quotas et sandbox." },
  { date: "2026-04-01", version: "v1.0", change: "Lancement API publique contacts, opportunités et tâches." },
]

export const partnerConnectorReference = [
  { provider: "Google Calendar", status: "Configuration suivie", capability: "Synchronisation rendez-vous et relances calendrier." },
  { provider: "Outlook Calendar", status: "Configuration suivie", capability: "Diagnostic token expiré et reconnexion utilisateur." },
  { provider: "Gmail", status: "Configuration suivie", capability: "Historique email et envoi contrôlé via compte connecté." },
  { provider: "Outlook Mail", status: "Configuration suivie", capability: "Suivi des erreurs mail et reconnexion." },
  { provider: "Brevo", status: "Configuration suivie", capability: "Campagnes marketing, listes et délivrabilité." },
  { provider: "Make / Zapier", status: "Webhook prêt", capability: "Automatisations no-code via événements signés." },
]

export const connectorProviderCatalog = [
  {
    key: "google-calendar",
    name: "Google Calendar",
    category: "Calendrier",
    authMethod: "OAuth Google",
    testMode: "oauth_status",
    setupHint: "Connecter le compte conseiller via OAuth Google puis vérifier la dernière synchronisation.",
    requiredFields: ["Compte Google"],
  },
  {
    key: "outlook-calendar",
    name: "Outlook Calendar",
    category: "Calendrier",
    authMethod: "OAuth Microsoft",
    testMode: "oauth_status",
    setupHint: "Connecter le compte Microsoft et surveiller les erreurs de token expiré.",
    requiredFields: ["Compte Microsoft"],
  },
  {
    key: "gmail",
    name: "Gmail",
    category: "Email",
    authMethod: "OAuth Google",
    testMode: "oauth_status",
    setupHint: "Connecter Gmail depuis les paramètres conseiller pour activer l’historique et l’envoi contrôlé.",
    requiredFields: ["Compte Gmail"],
  },
  {
    key: "outlook-mail",
    name: "Outlook Mail",
    category: "Email",
    authMethod: "OAuth Microsoft",
    testMode: "oauth_status",
    setupHint: "Connecter Outlook Mail et suivre les erreurs de synchronisation.",
    requiredFields: ["Compte Outlook"],
  },
  {
    key: "brevo",
    name: "Brevo",
    category: "Marketing",
    authMethod: "Clé API Brevo",
    testMode: "api_key_present",
    setupHint: "Enregistrer une clé API Brevo. La clé est hachée et non réaffichable.",
    requiredFields: ["Compte Brevo", "Clé API"],
  },
  {
    key: "make",
    name: "Make",
    category: "Automatisation",
    authMethod: "Webhook HTTPS",
    testMode: "webhook_post",
    setupHint: "Renseigner l’URL du webhook Make pour envoyer un événement test.",
    requiredFields: ["URL webhook Make"],
  },
  {
    key: "zapier",
    name: "Zapier",
    category: "Automatisation",
    authMethod: "Webhook HTTPS",
    testMode: "webhook_post",
    setupHint: "Renseigner l’URL Catch Hook Zapier pour envoyer un événement test.",
    requiredFields: ["URL Catch Hook Zapier"],
  },
  {
    key: "n8n",
    name: "n8n",
    category: "Automatisation avancée",
    authMethod: "Webhook HTTPS",
    testMode: "webhook_post",
    setupHint: "Renseigner l’URL webhook n8n pour tester un flux serveur.",
    requiredFields: ["URL webhook n8n"],
  },
] as const

export type ConnectorProviderKey = (typeof connectorProviderCatalog)[number]["key"]

export function getConnectorProvider(key: string) {
  return connectorProviderCatalog.find((provider) => provider.key === key) ?? connectorProviderCatalog[0]
}
