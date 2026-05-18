import { getWorkflowRuntimeStatus, workflowSecret } from "@/lib/automation/workflows"

type N8nHealthResult = {
  configured: boolean
  apiUrlConfigured: boolean
  apiKeyConfigured: boolean
  baseUrlConfigured: boolean
  webhookConfigured: boolean
  webhookSecretConfigured: boolean
  timeoutMs: number
  apiReachable: boolean
  checkedAt: string
  error?: string
  leadFormSmsWorkflow?: N8nWorkflowStatus
  leadFormMultichannelWorkflow?: N8nWorkflowStatus
  leadFormQualificationRoutingWorkflow?: N8nWorkflowStatus
  inboundCallReceptionWorkflow?: N8nWorkflowStatus
  retellAssurancePhoneAgentWorkflow?: N8nWorkflowStatus
}

export const LEAD_FORM_SMS_WORKFLOW_KEY = "lead.form.sms_confirmation"
export const LEAD_FORM_SMS_WORKFLOW_NAME = "FinAdvisor - SMS confirmation formulaire"
export const LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY = "lead.form.multichannel_followup"
export const LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME = "FinAdvisor - Formulaire multicanal"
export const LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY = "lead.form.ai_qualification_routing"
export const LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME = "FinAdvisor - Formulaire qualification IA et routage"
export const INBOUND_CALL_RECEPTION_WORKFLOW_KEY = "call.inbound.reception_advisor"
export const INBOUND_CALL_RECEPTION_WORKFLOW_NAME = "FinAdvisor - Réception appel conseiller"
export const RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY = "assurance.phone_agent"
export const RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME = "Agent téléphonique assurance - qualification prospects et appels entrants"
const LEAD_FORM_SMS_WEBHOOK_ID = "d61f7afb-2dd7-4d9b-9c03-3a6036c739b1"
const LEAD_FORM_MULTICHANNEL_WEBHOOK_ID = "4cebd2e9-3d6e-4dd4-8917-8f1f5217602c"
const LEAD_FORM_QUALIFICATION_ROUTING_WEBHOOK_ID = "aa01b16f-6277-4ec9-bb9c-58d33684ff0d"
const INBOUND_CALL_RECEPTION_WEBHOOK_ID = "ff5e0e3f-97e1-4da3-918f-203a78f57f89"
const RETELL_ASSURANCE_PHONE_AGENT_WEBHOOK_ID = "c7c8d148-730b-428f-ace7-a41e64d47755"
const RETELL_INBOUND_ASSURANCE_WEBHOOK_ID = "ce30898f-1b83-44ab-bf65-9428d457b4c1"
const RETELL_POST_CALL_ASSURANCE_WEBHOOK_ID = "f74036b9-50e8-485f-9ca4-d1c1d87a80f0"

export type N8nWorkflowStatus = {
  key: string
  name: string
  found: boolean
  id?: string
  active?: boolean
  lastExecutionAt?: string | null
  lastError?: string | null
  updatedAt?: string | null
}

type N8nWorkflowSummary = {
  id: string
  name: string
  active?: boolean
  updatedAt?: string | null
}

function envValue(name: string) {
  return process.env[name]?.trim() || undefined
}

function n8nApiBaseUrl() {
  return envValue("N8N_API_URL")?.replace(/\/$/, "")
}

function n8nApiKey() {
  return envValue("N8N_API_KEY")
}

function n8nBaseUrl() {
  return envValue("N8N_BASE_URL")?.replace(/\/$/, "")
}

function appBaseUrl() {
  return envValue("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") ?? envValue("APP_URL")?.replace(/\/$/, "")
}

function appApiUrl(path: string) {
  const baseUrl = appBaseUrl()
  return baseUrl ? `${baseUrl}${path.startsWith("/") ? path : `/${path}`}` : `https://TON-DOMAINE-APP.com${path.startsWith("/") ? path : `/${path}`}`
}

function appSecretExpression() {
  return workflowSecret() ?? "CHANGE_ME_SHARED_SECRET"
}

function retellAuthorizationHeaderValue() {
  const apiKey = envValue("RETELL_API_KEY")
  return apiKey ? `Bearer ${apiKey}` : '={{ "Bearer " + $env.RETELL_API_KEY }}'
}

function n8nTimeoutMs() {
  const workflow = getWorkflowRuntimeStatus()
  return workflow.timeoutMs
}

function n8nApiPath(path: string) {
  const baseUrl = n8nApiBaseUrl()
  if (!baseUrl) return undefined
  return `${baseUrl}/api/v1${path.startsWith("/") ? path : `/${path}`}`
}

async function n8nApiFetch(path: string, init?: RequestInit) {
  const url = n8nApiPath(path)
  const apiKey = n8nApiKey()
  if (!url || !apiKey) throw new Error("N8N_API_NOT_CONFIGURED")

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  const text = await response.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text) as unknown
    } catch {
      json = null
    }
  }
  if (!response.ok) {
    const detail = typeof json === "object" && json !== null && "message" in json
      ? String((json as { message?: unknown }).message)
      : text.slice(0, 240)
    throw new Error(`N8N_API_FAILED_${response.status}:${detail}`)
  }
  return json
}

function workflowList(value: unknown): N8nWorkflowSummary[] {
  const maybeRecord = value && typeof value === "object" ? value as { data?: unknown } : {}
  const items = Array.isArray(value) ? value : Array.isArray(maybeRecord.data) ? maybeRecord.data : []
  return items.filter((item): item is N8nWorkflowSummary => {
    return Boolean(item && typeof item === "object" && "id" in item && "name" in item)
  })
}

async function findN8nWorkflowByName(name: string) {
  const result = await n8nApiFetch("/workflows?limit=100")
  return workflowList(result).find((workflow) => workflow.name === name) ?? null
}

async function workflowLastExecution(workflowId: string) {
  try {
    const result = await n8nApiFetch(`/executions?workflowId=${encodeURIComponent(workflowId)}&limit=1&includeData=false`)
    const maybeRecord = result && typeof result === "object" ? result as { data?: unknown } : {}
    const items = Array.isArray(result) ? result : Array.isArray(maybeRecord.data) ? maybeRecord.data : []
    const execution = items[0] as { startedAt?: string; stoppedAt?: string; status?: string; error?: { message?: string } } | undefined
    if (!execution) return { lastExecutionAt: null, lastError: null }
    return {
      lastExecutionAt: execution.stoppedAt ?? execution.startedAt ?? null,
      lastError: execution.status === "error" ? execution.error?.message ?? "Dernière exécution en erreur." : null,
    }
  } catch {
    return { lastExecutionAt: null, lastError: null }
  }
}

function workflowWebhookPath(workflowKey: string) {
  return `finadvisor/${workflowKey}`
}

function workflowWebhookId(workflowKey: string) {
  if (workflowKey === LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY) return LEAD_FORM_MULTICHANNEL_WEBHOOK_ID
  if (workflowKey === LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY) return LEAD_FORM_QUALIFICATION_ROUTING_WEBHOOK_ID
  if (workflowKey === INBOUND_CALL_RECEPTION_WORKFLOW_KEY) return INBOUND_CALL_RECEPTION_WEBHOOK_ID
  if (workflowKey === RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY) return RETELL_ASSURANCE_PHONE_AGENT_WEBHOOK_ID
  return LEAD_FORM_SMS_WEBHOOK_ID
}

function leadFormSmsWorkflowPayload() {
  const webhookId = "FinAdvisorWebhook"
  const sendSmsId = "SendSmsCallback"
  const successId = "SuccessResponse"

  return {
    name: LEAD_FORM_SMS_WORKFLOW_NAME,
    nodes: [
      {
        id: webhookId,
        name: "Réception FinAdvisor",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: workflowWebhookId(LEAD_FORM_SMS_WORKFLOW_KEY),
        position: [240, 260],
        parameters: {
          httpMethod: "POST",
          path: workflowWebhookPath(LEAD_FORM_SMS_WORKFLOW_KEY),
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: sendSmsId,
        name: "Demander SMS à FinAdvisor",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [520, 260],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "send_sms" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "SMS confirmation formulaire envoyé" },
              { name: "description", value: "Confirmation SMS demandée par n8n." },
              { name: "message", value: '={{ $node["Réception FinAdvisor"].json.body.params.smsTemplate || "Bonjour, votre demande a bien été reçue. Un conseiller vous contactera sous peu." }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: successId,
        name: "Réponse FinAdvisor",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [800, 260],
        parameters: {
          respondWith: "json",
          responseBody: '{"ok":true,"message":"Workflow n8n exécuté"}',
          options: {},
        },
      },
    ],
    connections: {
      "Réception FinAdvisor": {
        main: [[{ node: "Demander SMS à FinAdvisor", type: "main", index: 0 }]],
      },
      "Demander SMS à FinAdvisor": {
        main: [[{ node: "Réponse FinAdvisor", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  }
}

function leadFormMultichannelWorkflowPayload() {
  const webhookId = "FinAdvisorWebhook"
  const smsId = "SendSmsCallback"
  const emailProofId = "EmailProofCallback"
  const sheetsProofId = "SheetsProofCallback"
  const taskId = "CreateTaskCallback"
  const successId = "SuccessResponse"

  return {
    name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME,
    nodes: [
      {
        id: webhookId,
        name: "Réception FinAdvisor",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: workflowWebhookId(LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY),
        position: [160, 260],
        parameters: {
          httpMethod: "POST",
          path: workflowWebhookPath(LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY),
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: smsId,
        name: "Demander SMS à FinAdvisor",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [420, 120],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "send_sms" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "SMS confirmation formulaire envoyé" },
              { name: "description", value: "SMS demandé par workflow multicanal n8n." },
              { name: "message", value: '={{ $node["Réception FinAdvisor"].json.body.params.smsTemplate }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: emailProofId,
        name: "Journal courriel HTML",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [420, 260],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "send_email" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "Courriel HTML envoyé par workflow" },
              { name: "subject", value: '={{ $node["Réception FinAdvisor"].json.body.params.emailSubject || "Votre demande a bien été reçue" }}' },
              { name: "html", value: '={{ $node["Réception FinAdvisor"].json.body.params.emailHtml }}' },
              { name: "text", value: "Votre demande a bien été reçue. Un conseiller vous contactera sous peu." },
            ],
          },
          options: {},
        },
      },
      {
        id: sheetsProofId,
        name: "Journal Google Sheets",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [420, 400],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "append_google_sheet" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "leadFormId", value: '={{ $node["Réception FinAdvisor"].json.body.payload.leadFormId }}' },
              { name: "submissionId", value: '={{ $node["Réception FinAdvisor"].json.body.payload.submissionId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "Google Sheets synchronisé par workflow" },
            ],
          },
          options: {},
        },
      },
      {
        id: taskId,
        name: "Créer tâche conseiller",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [700, 260],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "create_task" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: '={{ $node["Réception FinAdvisor"].json.body.params.taskTitle || "Suivi formulaire web multicanal" }}' },
              { name: "description", value: '={{ $node["Réception FinAdvisor"].json.body.params.taskDescription || "Vérifier la demande formulaire et confirmer le besoin du prospect." }}' },
              { name: "priority", value: '={{ $node["Réception FinAdvisor"].json.body.params.taskPriority || "HIGH" }}' },
              { name: "dueInHours", value: '={{ $node["Réception FinAdvisor"].json.body.params.taskDueInHours || 2 }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: successId,
        name: "Réponse FinAdvisor",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [980, 260],
        parameters: {
          respondWith: "json",
          responseBody: '{"ok":true,"message":"Workflow multicanal exécuté"}',
          options: {},
        },
      },
    ],
    connections: {
      "Réception FinAdvisor": {
        main: [
          [
            { node: "Demander SMS à FinAdvisor", type: "main", index: 0 },
            { node: "Journal courriel HTML", type: "main", index: 0 },
            { node: "Journal Google Sheets", type: "main", index: 0 },
          ],
        ],
      },
      "Journal courriel HTML": {
        main: [[{ node: "Créer tâche conseiller", type: "main", index: 0 }]],
      },
      "Créer tâche conseiller": {
        main: [[{ node: "Réponse FinAdvisor", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  }
}

function leadFormQualificationRoutingWorkflowPayload() {
  const webhookId = "FinAdvisorWebhook"
  const aiId = "OpenAiQualification"
  const routeId = "RouteLeadCallback"
  const successId = "SuccessResponse"

  const aiJsonExpression = '={{ (() => { try { const content = $node["Analyse IA OpenAI"].json.choices?.[0]?.message?.content || "{}"; return JSON.parse(content.replace(/```json|```/g, "").trim()); } catch (e) { return {}; } })() }}'
  const detectedNeedExpression = '={{ (() => { const ai = ' + aiJsonExpression.slice(3, -3) + '; const body = $node["Réception FinAdvisor"].json.body || {}; const payload = body.payload || {}; const text = [payload.interestType, payload.message, body.params?.message].filter(Boolean).join(" ").toLowerCase(); if (ai.detectedNeed) return ai.detectedNeed; if (text.includes("invalid")) return "invalidité"; if (text.includes("placement") || text.includes("invest")) return "placement"; if (text.includes("retraite") || text.includes("pension")) return "retraite"; if (text.includes("entreprise") || text.includes("corpor") || text.includes("actionnaire")) return "entreprise"; if (text.includes("vie") || text.includes("assurance") || text.includes("hypoth")) return "assurance vie"; return "général"; })() }}'
  const urgencyExpression = '={{ (() => { const ai = ' + aiJsonExpression.slice(3, -3) + '; const body = $node["Réception FinAdvisor"].json.body || {}; const payload = body.payload || {}; const text = [payload.interestType, payload.message].filter(Boolean).join(" ").toLowerCase(); if (ai.urgency) return ai.urgency; if (text.includes("urgent") || text.includes("rapidement") || text.includes("aujourd")) return "URGENT"; if (text.includes("cette semaine") || text.includes("important")) return "HIGH"; if (text.includes("pas press") || text.includes("plus tard")) return "LOW"; return "HIGH"; })() }}'
  const budgetExpression = '={{ (() => { const ai = ' + aiJsonExpression.slice(3, -3) + '; const payload = ($node["Réception FinAdvisor"].json.body || {}).payload || {}; const text = [payload.message, payload.interestType].filter(Boolean).join(" "); if (ai.budget) return ai.budget; const match = text.match(/(?:budget|montant|prime|investir|placement)?\\s*(\\$?\\s?\\d[\\d\\s.,]*(?:k|K)?\\s?\\$?)/); return match ? match[1].trim() : ""; })() }}'
  const rationaleExpression = '={{ (() => { const ai = ' + aiJsonExpression.slice(3, -3) + '; return ai.rationale || "Analyse n8n avec fallback FinAdvisor. Routage demandé."; })() }}'

  return {
    name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME,
    nodes: [
      {
        id: webhookId,
        name: "Réception FinAdvisor",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: workflowWebhookId(LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY),
        position: [180, 260],
        parameters: {
          httpMethod: "POST",
          path: workflowWebhookPath(LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY),
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: aiId,
        name: "Analyse IA OpenAI",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [470, 260],
        continueOnFail: true,
        parameters: {
          method: "POST",
          url: "https://api.openai.com/v1/chat/completions",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $env.OPENAI_API_KEY }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "json",
          jsonBody: '={{ JSON.stringify({ model: $env.OPENAI_MODEL || "gpt-4.1-mini", temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Tu qualifies un prospect pour un cabinet financier canadien. Réponds seulement en JSON avec detectedNeed, urgency, budget, rationale. detectedNeed doit être assurance vie, invalidité, placement, retraite, entreprise ou général. urgency doit être LOW, NORMAL, HIGH ou URGENT." }, { role: "user", content: "Intérêt: " + (($node["Réception FinAdvisor"].json.body.payload || {}).interestType || "") + "\\nMessage: " + (($node["Réception FinAdvisor"].json.body.payload || {}).message || "") }] }) }}',
          options: {},
        },
      },
      {
        id: routeId,
        name: "Qualifier et router dans FinAdvisor",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [780, 260],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "route_lead" },
              { name: "organizationId", value: '={{ $node["Réception FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception FinAdvisor"].json.body.leadId }}' },
              { name: "leadFormId", value: '={{ $node["Réception FinAdvisor"].json.body.payload.leadFormId }}' },
              { name: "submissionId", value: '={{ $node["Réception FinAdvisor"].json.body.payload.submissionId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "Qualification IA et routage conseiller" },
              { name: "detectedNeed", value: detectedNeedExpression },
              { name: "urgency", value: urgencyExpression },
              { name: "budget", value: budgetExpression },
              { name: "rationale", value: rationaleExpression },
            ],
          },
          options: {},
        },
      },
      {
        id: successId,
        name: "Réponse FinAdvisor",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [1080, 260],
        parameters: {
          respondWith: "json",
          responseBody: '{"ok":true,"message":"Qualification et routage demandés"}',
          options: {},
        },
      },
    ],
    connections: {
      "Réception FinAdvisor": {
        main: [[{ node: "Analyse IA OpenAI", type: "main", index: 0 }]],
      },
      "Analyse IA OpenAI": {
        main: [[{ node: "Qualifier et router dans FinAdvisor", type: "main", index: 0 }]],
      },
      "Qualifier et router dans FinAdvisor": {
        main: [[{ node: "Réponse FinAdvisor", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  }
}

function inboundCallReceptionWorkflowPayload() {
  const webhookId = "FinAdvisorWebhook"
  const activityId = "CreateCallActivity"
  const taskId = "CreateAdvisorTask"
  const smsId = "SendCallerSms"
  const successId = "SuccessResponse"

  return {
    name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME,
    nodes: [
      {
        id: webhookId,
        name: "Réception appel FinAdvisor",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: workflowWebhookId(INBOUND_CALL_RECEPTION_WORKFLOW_KEY),
        position: [180, 260],
        parameters: {
          httpMethod: "POST",
          path: workflowWebhookPath(INBOUND_CALL_RECEPTION_WORKFLOW_KEY),
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: activityId,
        name: "Journal réception appel",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [470, 120],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception appel FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception appel FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "create_activity" },
              { name: "organizationId", value: '={{ $node["Réception appel FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception appel FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception appel FinAdvisor"].json.body.leadId }}' },
              { name: "clientId", value: '={{ $node["Réception appel FinAdvisor"].json.body.clientId }}' },
              { name: "callId", value: '={{ $node["Réception appel FinAdvisor"].json.body.entityId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception appel FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception appel FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "Réception appel orchestrée par n8n" },
              { name: "description", value: '={{ "Appel entrant de " + ($node["Réception appel FinAdvisor"].json.body.payload.fromNumber || $node["Réception appel FinAdvisor"].json.body.payload.phone || "numéro inconnu") }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: taskId,
        name: "Créer tâche conseiller",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [470, 300],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception appel FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception appel FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "create_task" },
              { name: "organizationId", value: '={{ $node["Réception appel FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception appel FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception appel FinAdvisor"].json.body.leadId }}' },
              { name: "clientId", value: '={{ $node["Réception appel FinAdvisor"].json.body.clientId }}' },
              { name: "callId", value: '={{ $node["Réception appel FinAdvisor"].json.body.entityId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception appel FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception appel FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: '={{ $node["Réception appel FinAdvisor"].json.body.params.taskTitle || "Rappeler après appel entrant" }}' },
              { name: "description", value: '={{ ($node["Réception appel FinAdvisor"].json.body.params.taskDescription || "Appel entrant reçu. Vérifier le dossier, rappeler la personne et documenter le besoin.") + "\\nNuméro: " + ($node["Réception appel FinAdvisor"].json.body.payload.fromNumber || $node["Réception appel FinAdvisor"].json.body.payload.phone || "") }}' },
              { name: "priority", value: '={{ $node["Réception appel FinAdvisor"].json.body.params.taskPriority || "URGENT" }}' },
              { name: "dueInHours", value: '={{ $node["Réception appel FinAdvisor"].json.body.params.taskDueInHours || 1 }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: smsId,
        name: "SMS accusé réception appel",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [750, 300],
        parameters: {
          method: "POST",
          url: '={{ $node["Réception appel FinAdvisor"].json.body.callback.url }}',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $node["Réception appel FinAdvisor"].json.body.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "send_sms" },
              { name: "organizationId", value: '={{ $node["Réception appel FinAdvisor"].json.body.organizationId }}' },
              { name: "userId", value: '={{ $node["Réception appel FinAdvisor"].json.body.userId }}' },
              { name: "leadId", value: '={{ $node["Réception appel FinAdvisor"].json.body.leadId }}' },
              { name: "clientId", value: '={{ $node["Réception appel FinAdvisor"].json.body.clientId }}' },
              { name: "callId", value: '={{ $node["Réception appel FinAdvisor"].json.body.entityId }}' },
              { name: "automationRuleId", value: '={{ $node["Réception appel FinAdvisor"].json.body.automationRuleId }}' },
              { name: "workflowKey", value: '={{ $node["Réception appel FinAdvisor"].json.body.workflowKey }}' },
              { name: "title", value: "SMS appel reçu envoyé" },
              { name: "message", value: '={{ $node["Réception appel FinAdvisor"].json.body.params.callerSmsTemplate || "Bonjour, nous avons bien reçu votre appel. Un conseiller vous contactera rapidement." }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: successId,
        name: "Réponse FinAdvisor",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [1040, 300],
        parameters: {
          respondWith: "json",
          responseBody: '{"ok":true,"message":"Réception appel traitée par n8n"}',
          options: {},
        },
      },
    ],
    connections: {
      "Réception appel FinAdvisor": {
        main: [
          [
            { node: "Journal réception appel", type: "main", index: 0 },
            { node: "Créer tâche conseiller", type: "main", index: 0 },
          ],
        ],
      },
      "Créer tâche conseiller": {
        main: [[{ node: "SMS accusé réception appel", type: "main", index: 0 }]],
      },
      "SMS accusé réception appel": {
        main: [[{ node: "Réponse FinAdvisor", type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  }
}

function retellAssurancePhoneAgentWorkflowPayload() {
  const overviewNoteId = "NoteOverviewAssurance"
  const outboundNoteId = "NoteOutboundAssurance"
  const inboundNoteId = "NoteInboundAssurance"
  const postCallNoteId = "NotePostCallAssurance"
  const newProspectWebhookId = "NewProspectWebhook"
  const validateId = "ValidateConsentPhone"
  const smsNoticeId = "SmsNoticeCallback"
  const waitId = "WaitBeforeRetellCall"
  const createRetellCallId = "CreateRetellAssuranceCall"
  const inboundWebhookId = "RetellInboundWebhook"
  const lookupId = "LookupInboundCaller"
  const inboundResponseId = "RespondRetellDynamicVariables"
  const postCallWebhookId = "RetellPostCallWebhook"
  const filterAnalyzedId = "FilterAnalyzedCalls"
  const updateCrmId = "UpdateFinAdvisorPostCall"
  const openAiPostCallId = "OpenAiMemoryQualityNote"
  const gmailGateId = "GmailNativeEnabledGate"
  const gmailPostCallId = "GmailNativeAdvisorSummary"
  const postCallResponseId = "PostCallResponse"

  const backendSecret = appSecretExpression()
  const retellFromNumberFallback = JSON.stringify(envValue("RETELL_FROM_NUMBER") ?? envValue("TWILIO_PHONE_NUMBER") ?? "")
  const retellAgentIdFallback = JSON.stringify(envValue("RETELL_AGENT_ID") ?? "")

  return {
    name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME,
    nodes: [
      {
        id: overviewNoteId,
        name: "Note - Vue générale assurance",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-280, -460],
        parameters: {
          width: 1320,
          height: 400,
          content: "# Agent téléphonique pour assurance\n\nCe workflow automatise la préqualification de prospects en assurance, la gestion des appels entrants RetellAI, la mise à jour du dossier CRM et l'envoi d'un résumé au conseiller.\n\nMémoire : FinAdvisor renvoie à RetellAI les sujets CRM récents, les derniers appels, les tâches ouvertes et les notes utiles via les variables dynamiques conversation_memory, previous_topics, last_call_summary et open_tasks.\n\nPersonnalisation conseiller : FinAdvisor envoie aussi advisor_greeting, advisor_sms_notice, advisor_tone, advisor_booking_link, advisor_specialties, advisor_language, advisor_availability et advisor_qualification_type.\n\nImportant : l'agent vocal préqualifie et prépare le dossier. Il ne recommande pas de produit, ne donne pas de conseil personnalisé et ne conclut pas de vente.",
        },
      },
      {
        id: outboundNoteId,
        name: "Note - Qualification sortante assurance",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-280, 0],
        parameters: {
          width: 1320,
          height: 340,
          content: "# Qualification sortante assurance\n\n1. Nouveau prospect reçu depuis FinAdvisor\n2. Validation consentement + téléphone\n3. SMS de préavis personnalisé par conseiller\n4. Attente selon le délai configuré par conseiller\n5. Appel RetellAI avec variables dynamiques\n\nLes numéros doivent être au format E.164.",
        },
      },
      {
        id: inboundNoteId,
        name: "Note - Appels entrants assurance",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-280, 400],
        parameters: {
          color: 5,
          width: 1320,
          height: 330,
          content: "# Appels entrants assurance\n\nRetellAI appelle ce webhook pour enrichir l'appel entrant. n8n interroge FinAdvisor par numéro de téléphone et retourne les variables dynamiques à RetellAI, y compris la mémoire CRM récente du client.",
        },
      },
      {
        id: postCallNoteId,
        name: "Note - Traitement post-appel assurance",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [1080, -460],
        parameters: {
          color: 4,
          width: 1560,
          height: 900,
          content: "# Traitement post-appel assurance\n\nDéclenché par le webhook RetellAI quand l'appel est analysé.\n\nLe workflow envoie le résumé, la transcription, le score, l'urgence, les disponibilités et la prochaine action à FinAdvisor. L'API FinAdvisor crée ensuite la tâche conseiller, l'activité CRM, la notification, le SMS et le courriel Gmail/Resend.\n\nUne section OpenAI/Gmail native est aussi présente : OpenAI génère une note qualité optionnelle dans n8n, puis Gmail peut envoyer un courriel si GMAIL_N8N_ENABLED=true et si les identifiants Gmail n8n sont configurés.",
        },
      },
      {
        id: newProspectWebhookId,
        name: "Recevoir nouveau prospect assurance depuis app",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: workflowWebhookId(RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY),
        position: [-180, 120],
        parameters: {
          path: workflowWebhookPath(RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY),
          httpMethod: "POST",
          responseMode: "onReceived",
          responseData: "firstEntryJson",
          options: {},
        },
      },
      {
        id: validateId,
        name: "Valider consentement et téléphone",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [100, 120],
        parameters: {
          options: {},
          conditions: {
            options: { version: 2, leftValue: "", caseSensitive: true, typeValidation: "strict" },
            combinator: "and",
            conditions: [
              { id: "consent-to-call", leftValue: "={{ $json.params.consent_to_call || $json.payload.consent_to_call || $json.payload.consent || false }}", rightValue: true, operator: { type: "boolean", operation: "equals" } },
              { id: "phone-number", leftValue: "={{ $json.payload.phone_number || $json.payload.phone || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            ],
          },
        },
      },
      {
        id: smsNoticeId,
        name: "Envoyer SMS préavis assurance",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [360, 100],
        parameters: {
          method: "POST",
          url: "={{ $json.callback.url }}",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $json.callback.token }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          contentType: "json",
          specifyBody: "keypair",
          bodyParameters: {
            parameters: [
              { name: "action", value: "send_sms" },
              { name: "organizationId", value: "={{ $json.organizationId }}" },
              { name: "userId", value: "={{ $json.userId }}" },
              { name: "leadId", value: "={{ $json.leadId }}" },
              { name: "automationRuleId", value: "={{ $json.automationRuleId }}" },
              { name: "workflowKey", value: "={{ $json.workflowKey }}" },
              { name: "title", value: "SMS préavis appel RetellAI envoyé" },
              { name: "message", value: '={{ $json.payload.advisor_sms_notice || ("Bonjour " + (($json.payload.firstName || $json.payload.first_name || "") || "") + ", merci pour votre demande. Notre assistant vocal vous appellera sous peu afin de préparer votre échange avec un conseiller. Vous pourrez demander à parler à un humain en tout temps.") }}' },
            ],
          },
          options: {},
        },
      },
      {
        id: waitId,
        name: "Attendre 5 minutes avant appel assurance",
        type: "n8n-nodes-base.wait",
        typeVersion: 1.1,
        webhookId: "assurance-wait-before-call",
        position: [600, 100],
        parameters: { unit: "minutes", amount: "={{ Number($json.params.call_delay_minutes || $json.payload.advisor_call_delay_minutes || 5) }}" },
      },
      {
        id: createRetellCallId,
        name: "Créer appel RetellAI - Assurance",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [860, 100],
        parameters: {
          url: "https://api.retellai.com/v2/create-phone-call",
          method: "POST",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: retellAuthorizationHeaderValue() },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: '={{ JSON.stringify(Object.assign({ from_number: $env.RETELL_FROM_NUMBER || $json.params.from_number || ' + retellFromNumberFallback + ', to_number: $json.payload.phone_number || $json.payload.phone, retell_llm_dynamic_variables: { prospect_id: $json.leadId || $json.payload.prospect_id || "", advisor_id: $json.userId || $json.payload.advisor_id || "", advisor_name: $json.payload.advisor_name || "", advisor_email: $json.payload.advisor_email || "", first_name: $json.payload.firstName || $json.payload.first_name || "", last_name: $json.payload.lastName || $json.payload.last_name || "", phone_number: $json.payload.phone_number || $json.payload.phone || "", email: $json.payload.email || "", preferred_language: $json.payload.advisor_language || $json.payload.preferred_language || "fr", province: $json.payload.province || "QC", interest_type: $json.payload.interest_type || $json.payload.interestType || "", insurance_category: $json.payload.insurance_category || $json.payload.interestType || "", insurance_goal: $json.payload.insurance_goal || $json.payload.message || "", source: $json.payload.source || "CRM", conversation_memory: $json.payload.conversation_memory || "", previous_topics: $json.payload.previous_topics || "", last_call_summary: $json.payload.last_call_summary || "", open_tasks: $json.payload.open_tasks || "", advisor_voice_enabled: Boolean($json.payload.advisor_voice_enabled), advisor_greeting: $json.payload.advisor_greeting || "", advisor_sms_notice: $json.payload.advisor_sms_notice || "", advisor_tone: $json.payload.advisor_tone || "", advisor_language: $json.payload.advisor_language || "", advisor_call_delay_minutes: $json.payload.advisor_call_delay_minutes || $json.params.call_delay_minutes || 5, advisor_availability: $json.payload.advisor_availability || "", advisor_qualification_type: $json.payload.advisor_qualification_type || "", advisor_booking_link: $json.payload.advisor_booking_link || "", advisor_specialties: $json.payload.advisor_specialties || "", advisor_custom_instructions: $json.payload.advisor_custom_instructions || "", consent_to_call: Boolean($json.params.consent_to_call || $json.payload.consent_to_call || $json.payload.consent), consent_to_recording: Boolean($json.params.consent_to_recording || $json.payload.consent_to_recording) } }, ($env.RETELL_AGENT_ID || ' + retellAgentIdFallback + ') ? { agent_id: $env.RETELL_AGENT_ID || ' + retellAgentIdFallback + ' } : {})) }}',
          options: {},
        },
      },
      {
        id: inboundWebhookId,
        name: "Recevoir appel entrant RetellAI - Assurance",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: RETELL_INBOUND_ASSURANCE_WEBHOOK_ID,
        position: [-180, 500],
        parameters: {
          path: "retell/inbound-assurance",
          httpMethod: "POST",
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: lookupId,
        name: "Rechercher client assurance dans app",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [220, 500],
        parameters: {
          url: appApiUrl("/api/retell/inbound-assurance-lookup"),
          method: "POST",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Content-Type", value: "application/json" },
              { name: "X-N8N-SECRET", value: backendSecret },
            ],
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: '={{ JSON.stringify({ from_number: $json.body.call_inbound?.from_number || $json.body.from_number || $json.body.call?.from_number, to_number: $json.body.call_inbound?.to_number || $json.body.to_number || $json.body.call?.to_number, call_id: $json.body.call_inbound?.call_id || $json.body.call_id || $json.body.call?.call_id, raw_call: $json.body }) }}',
          options: {},
        },
      },
      {
        id: inboundResponseId,
        name: "Répondre à RetellAI - Variables assurance",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [620, 500],
        parameters: {
          respondWith: "json",
          responseBody: '={{ JSON.stringify({ call_inbound: { dynamic_variables: $json.dynamic_variables || { prospect_id: $json.prospect_id || "unknown", client_known: Boolean($json.client_known), first_name: $json.first_name || "client", last_name: $json.last_name || "", advisor_id: $json.advisor_id || "", advisor_name: $json.advisor_name || "un conseiller", advisor_email: $json.advisor_email || "", preferred_language: $json.advisor_language || $json.preferred_language || "fr", province: $json.province || "", insurance_category: $json.insurance_category || "à déterminer", insurance_goal: $json.insurance_goal || "à déterminer", status: $json.status || "nouveau", conversation_memory: $json.conversation_memory || "", previous_topics: $json.previous_topics || "", last_call_summary: $json.last_call_summary || "", open_tasks: $json.open_tasks || "", advisor_voice_enabled: Boolean($json.advisor_voice_enabled), advisor_greeting: $json.advisor_greeting || "", advisor_sms_notice: $json.advisor_sms_notice || "", advisor_tone: $json.advisor_tone || "", advisor_language: $json.advisor_language || "", advisor_call_delay_minutes: $json.advisor_call_delay_minutes || 5, advisor_availability: $json.advisor_availability || "", advisor_qualification_type: $json.advisor_qualification_type || "", advisor_booking_link: $json.advisor_booking_link || "", advisor_specialties: $json.advisor_specialties || "", advisor_custom_instructions: $json.advisor_custom_instructions || "" } } }) }}',
          options: {},
        },
      },
      {
        id: postCallWebhookId,
        name: "Recevoir données post-appel RetellAI - Assurance",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        webhookId: RETELL_POST_CALL_ASSURANCE_WEBHOOK_ID,
        position: [1180, 80],
        parameters: {
          path: "retell/post-call-assurance",
          httpMethod: "POST",
          responseMode: "responseNode",
          options: {},
        },
      },
      {
        id: filterAnalyzedId,
        name: "Filtrer appels analysés",
        type: "n8n-nodes-base.filter",
        typeVersion: 2.2,
        position: [1420, 80],
        parameters: {
          options: {},
          conditions: {
            options: { version: 2, leftValue: "", caseSensitive: true, typeValidation: "strict" },
            combinator: "and",
            conditions: [
              { id: "call-analyzed", leftValue: "={{ $json.body.event }}", rightValue: "call_analyzed", operator: { type: "string", operation: "equals", name: "filter.operator.equals" } },
            ],
          },
        },
      },
      {
        id: updateCrmId,
        name: "Mettre à jour dossier assurance dans app",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1660, 80],
        parameters: {
          url: appApiUrl("/api/retell/post-call-assurance"),
          method: "POST",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Content-Type", value: "application/json" },
              { name: "X-N8N-SECRET", value: backendSecret },
            ],
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: '={{ JSON.stringify({ event: $json.body.event, retell_call_id: $json.body.call?.call_id, direction: $json.body.call?.direction, prospect_id: $json.body.call?.retell_llm_dynamic_variables?.prospect_id || $json.body.call?.retell_llm_dynamic_variables?.uuid || null, advisor_id: $json.body.call?.retell_llm_dynamic_variables?.advisor_id || null, advisor_email: $json.body.call?.retell_llm_dynamic_variables?.advisor_email || null, first_name: $json.body.call?.call_analysis?.custom_analysis_data?.first_name || $json.body.call?.retell_llm_dynamic_variables?.first_name || null, last_name: $json.body.call?.call_analysis?.custom_analysis_data?.last_name || $json.body.call?.retell_llm_dynamic_variables?.last_name || null, phone_number: $json.body.call?.call_analysis?.custom_analysis_data?.phone_number || $json.body.call?.retell_llm_dynamic_variables?.phone_number || null, insurance_category: $json.body.call?.call_analysis?.custom_analysis_data?.insurance_category || $json.body.call?.retell_llm_dynamic_variables?.insurance_category || null, insurance_goal: $json.body.call?.call_analysis?.custom_analysis_data?.insurance_goal || null, current_coverage: $json.body.call?.call_analysis?.custom_analysis_data?.current_coverage || null, family_context: $json.body.call?.call_analysis?.custom_analysis_data?.family_context || null, business_context: $json.body.call?.call_analysis?.custom_analysis_data?.business_context || null, planning_topic: $json.body.call?.call_analysis?.custom_analysis_data?.planning_topic || null, life_stage: $json.body.call?.call_analysis?.custom_analysis_data?.life_stage || null, has_existing_advisor: $json.body.call?.call_analysis?.custom_analysis_data?.has_existing_advisor || null, investment_knowledge: $json.body.call?.call_analysis?.custom_analysis_data?.investment_knowledge || null, risk_discussion_needed: $json.body.call?.call_analysis?.custom_analysis_data?.risk_discussion_needed ?? null, documents_needed: $json.body.call?.call_analysis?.custom_analysis_data?.documents_needed || null, meeting_objective: $json.body.call?.call_analysis?.custom_analysis_data?.meeting_objective || null, urgency_level: $json.body.call?.call_analysis?.custom_analysis_data?.urgency_level || null, qualification_status: $json.body.call?.call_analysis?.custom_analysis_data?.qualification_status || $json.body.call?.call_analysis?.custom_analysis_data?.qualification || null, qualification_score: $json.body.call?.call_analysis?.custom_analysis_data?.qualification_score || null, appointment_requested: $json.body.call?.call_analysis?.custom_analysis_data?.appointment_requested || null, appointment_start_at: $json.body.call?.call_analysis?.custom_analysis_data?.appointment_start_at || null, appointment_end_at: $json.body.call?.call_analysis?.custom_analysis_data?.appointment_end_at || null, appointment_timezone: $json.body.call?.call_analysis?.custom_analysis_data?.appointment_timezone || null, preferred_availabilities: $json.body.call?.call_analysis?.custom_analysis_data?.preferred_availabilities || $json.body.call?.call_analysis?.custom_analysis_data?.availabilities || null, next_action: $json.body.call?.call_analysis?.custom_analysis_data?.next_action || null, human_review_required: $json.body.call?.call_analysis?.custom_analysis_data?.human_review_required ?? true, call_summary: $json.body.call?.call_analysis?.custom_analysis_data?.call_summary || $json.body.call?.call_analysis?.call_summary || null, transcript: $json.body.call?.transcript || null, recording_url: $json.body.call?.recording_url || null, raw_call: $json.body.call }) }}',
          options: {},
        },
      },
      {
        id: openAiPostCallId,
        name: "OpenAI - Note mémoire et qualité conseiller",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1900, 80],
        continueOnFail: true,
        parameters: {
          url: "https://api.openai.com/v1/chat/completions",
          method: "POST",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "Authorization", value: '={{ "Bearer " + $env.OPENAI_API_KEY }}' },
              { name: "Content-Type", value: "application/json" },
            ],
          },
          sendBody: true,
          specifyBody: "json",
          jsonBody: '={{ JSON.stringify({ model: $env.OPENAI_MODEL || "gpt-4.1-mini", temperature: 0.1, messages: [{ role: "system", content: "Tu aides un conseiller en assurance à réviser un appel RetellAI. Ne donne aucun conseil financier, fiscal, juridique ou d assurance. Résume seulement les faits, les anciens sujets utiles, les risques de conformité et la prochaine action." }, { role: "user", content: "Résumé FinAdvisor: " + (($json.data || $json).summary || "") + "\\nProchaine action: " + (($json.data || $json).nextAction || "") + "\\nTranscription: " + (($node[\\"Recevoir données post-appel RetellAI - Assurance\\"].json.body.call?.transcript || "").slice(0, 6000)) }] }) }}',
          options: {},
        },
      },
      {
        id: gmailGateId,
        name: "Gmail n8n activé ?",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [2140, 80],
        parameters: {
          options: {},
          conditions: {
            options: { version: 2, leftValue: "", caseSensitive: true, typeValidation: "strict" },
            combinator: "and",
            conditions: [
              { id: "gmail-n8n-enabled", leftValue: "={{ Boolean($env.GMAIL_N8N_ENABLED) }}", rightValue: true, operator: { type: "boolean", operation: "equals" } },
            ],
          },
        },
      },
      {
        id: gmailPostCallId,
        name: "Gmail - Envoyer résumé conseiller optionnel",
        type: "n8n-nodes-base.gmail",
        typeVersion: 2.1,
        position: [2380, -20],
        parameters: {
          sendTo: '={{ $node["Recevoir données post-appel RetellAI - Assurance"].json.body.call?.retell_llm_dynamic_variables?.advisor_email || ($node["Mettre à jour dossier assurance dans app"].json.data || $node["Mettre à jour dossier assurance dans app"].json).advisorEmail || "conseiller@example.com" }}',
          subject: "Nouveau prospect assurance - résumé d'appel",
          emailType: "text",
          message: '={{ "Nouveau résumé d appel assurance\\n\\nClient: " + (($node["Mettre à jour dossier assurance dans app"].json.data || $node["Mettre à jour dossier assurance dans app"].json).firstName || "") + " " + (($node["Mettre à jour dossier assurance dans app"].json.data || $node["Mettre à jour dossier assurance dans app"].json).lastName || "") + "\\nTéléphone: " + (($node["Mettre à jour dossier assurance dans app"].json.data || $node["Mettre à jour dossier assurance dans app"].json).phoneNumber || "") + "\\n\\nRésumé FinAdvisor:\\n" + (($node["Mettre à jour dossier assurance dans app"].json.data || $node["Mettre à jour dossier assurance dans app"].json).summary || "") + "\\n\\nNote OpenAI n8n:\\n" + ($json.choices?.[0]?.message?.content || $json.error?.message || "Note OpenAI non disponible.") + "\\n\\nImportant: le conseiller doit valider les informations avant toute recommandation." }}',
          options: {},
        },
      },
      {
        id: postCallResponseId,
        name: "Réponse post-appel",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1,
        position: [2620, 120],
        parameters: {
          respondWith: "json",
          responseBody: '={{ JSON.stringify({ ok: true, message: "Post-appel assurance traité", finadvisor: $json.data || $json }) }}',
          options: {},
        },
      },
    ],
    connections: {
      "Recevoir nouveau prospect assurance depuis app": { main: [[{ node: "Valider consentement et téléphone", type: "main", index: 0 }]] },
      "Valider consentement et téléphone": { main: [[{ node: "Envoyer SMS préavis assurance", type: "main", index: 0 }], []] },
      "Envoyer SMS préavis assurance": { main: [[{ node: "Attendre 5 minutes avant appel assurance", type: "main", index: 0 }]] },
      "Attendre 5 minutes avant appel assurance": { main: [[{ node: "Créer appel RetellAI - Assurance", type: "main", index: 0 }]] },
      "Recevoir appel entrant RetellAI - Assurance": { main: [[{ node: "Rechercher client assurance dans app", type: "main", index: 0 }]] },
      "Rechercher client assurance dans app": { main: [[{ node: "Répondre à RetellAI - Variables assurance", type: "main", index: 0 }]] },
      "Recevoir données post-appel RetellAI - Assurance": { main: [[{ node: "Filtrer appels analysés", type: "main", index: 0 }]] },
      "Filtrer appels analysés": { main: [[{ node: "Mettre à jour dossier assurance dans app", type: "main", index: 0 }]] },
      "Mettre à jour dossier assurance dans app": { main: [[{ node: "OpenAI - Note mémoire et qualité conseiller", type: "main", index: 0 }]] },
      "OpenAI - Note mémoire et qualité conseiller": { main: [[{ node: "Gmail n8n activé ?", type: "main", index: 0 }]] },
      "Gmail n8n activé ?": { main: [[{ node: "Gmail - Envoyer résumé conseiller optionnel", type: "main", index: 0 }], [{ node: "Réponse post-appel", type: "main", index: 0 }]] },
      "Gmail - Envoyer résumé conseiller optionnel": { main: [[{ node: "Réponse post-appel", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  }
}

async function getWorkflowStatus({ key, name }: { key: string; name: string }): Promise<N8nWorkflowStatus> {
  const base = {
    key,
    name,
  }

  try {
    const workflow = await findN8nWorkflowByName(name)
    if (!workflow) return { ...base, found: false }
    const last = await workflowLastExecution(workflow.id)
    return {
      ...base,
      found: true,
      id: workflow.id,
      active: Boolean(workflow.active),
      updatedAt: workflow.updatedAt ?? null,
      ...last,
    }
  } catch (error) {
    return {
      ...base,
      found: false,
      lastError: safeError(error),
    }
  }
}

export function getLeadFormSmsWorkflowStatus(): Promise<N8nWorkflowStatus> {
  return getWorkflowStatus({ key: LEAD_FORM_SMS_WORKFLOW_KEY, name: LEAD_FORM_SMS_WORKFLOW_NAME })
}

export function getLeadFormMultichannelWorkflowStatus(): Promise<N8nWorkflowStatus> {
  return getWorkflowStatus({ key: LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY, name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME })
}

export function getLeadFormQualificationRoutingWorkflowStatus(): Promise<N8nWorkflowStatus> {
  return getWorkflowStatus({ key: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY, name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME })
}

export function getInboundCallReceptionWorkflowStatus(): Promise<N8nWorkflowStatus> {
  return getWorkflowStatus({ key: INBOUND_CALL_RECEPTION_WORKFLOW_KEY, name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME })
}

export function getRetellAssurancePhoneAgentWorkflowStatus(): Promise<N8nWorkflowStatus> {
  return getWorkflowStatus({ key: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY, name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME })
}

async function upsertWorkflow({ name, payload }: { name: string; payload: Record<string, unknown> }) {
  const existing = await findN8nWorkflowByName(name)
  const workflow = existing
    ? await n8nApiFetch(`/workflows/${encodeURIComponent(existing.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }) as N8nWorkflowSummary
    : await n8nApiFetch("/workflows", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as N8nWorkflowSummary

  const id = workflow.id ?? existing?.id
  if (id) {
    try {
      await n8nApiFetch(`/workflows/${encodeURIComponent(id)}/activate`, { method: "POST" })
    } catch {
      try {
        await n8nApiFetch(`/workflows/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        })
      } catch {
        // Some n8n deployments require manual activation after import.
      }
    }
  }

  return true
}

export async function upsertLeadFormSmsWorkflow() {
  await upsertWorkflow({ name: LEAD_FORM_SMS_WORKFLOW_NAME, payload: leadFormSmsWorkflowPayload() })
  return getLeadFormSmsWorkflowStatus()
}

export async function upsertLeadFormAutomationWorkflows() {
  await upsertWorkflow({ name: LEAD_FORM_SMS_WORKFLOW_NAME, payload: leadFormSmsWorkflowPayload() })
  await upsertWorkflow({ name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME, payload: leadFormMultichannelWorkflowPayload() })
  await upsertWorkflow({ name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME, payload: leadFormQualificationRoutingWorkflowPayload() })
  await upsertWorkflow({ name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME, payload: inboundCallReceptionWorkflowPayload() })
  await upsertWorkflow({ name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME, payload: retellAssurancePhoneAgentWorkflowPayload() })
  return {
    leadFormSmsWorkflow: await getLeadFormSmsWorkflowStatus(),
    leadFormMultichannelWorkflow: await getLeadFormMultichannelWorkflowStatus(),
    leadFormQualificationRoutingWorkflow: await getLeadFormQualificationRoutingWorkflowStatus(),
    inboundCallReceptionWorkflow: await getInboundCallReceptionWorkflowStatus(),
    retellAssurancePhoneAgentWorkflow: await getRetellAssurancePhoneAgentWorkflowStatus(),
  }
}

export async function upsertInboundCallReceptionWorkflow() {
  await upsertWorkflow({ name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME, payload: inboundCallReceptionWorkflowPayload() })
  return getInboundCallReceptionWorkflowStatus()
}

export async function upsertRetellAssurancePhoneAgentWorkflow() {
  await upsertWorkflow({ name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME, payload: retellAssurancePhoneAgentWorkflowPayload() })
  return getRetellAssurancePhoneAgentWorkflowStatus()
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 180)
  return "Erreur n8n inconnue"
}

export function getN8nConfigStatus() {
  const workflow = getWorkflowRuntimeStatus()
  const apiUrlConfigured = Boolean(n8nApiBaseUrl())
  const apiKeyConfigured = Boolean(n8nApiKey())
  const baseUrlConfigured = Boolean(n8nBaseUrl())

  return {
    configured: workflow.configured || (apiUrlConfigured && apiKeyConfigured),
    apiUrlConfigured,
    apiKeyConfigured,
    baseUrlConfigured,
    webhookConfigured: workflow.configured,
    webhookSecretConfigured: workflow.secretConfigured,
    timeoutMs: n8nTimeoutMs(),
  }
}

export async function checkN8nHealth(): Promise<N8nHealthResult> {
  const config = getN8nConfigStatus()
  const checkedAt = new Date().toISOString()
  const apiUrl = n8nApiPath("/workflows?limit=1")
  const apiKey = n8nApiKey()

  if (!apiUrl || !apiKey) {
    return {
      ...config,
      apiReachable: false,
      checkedAt,
      error: "N8N_API_URL ou N8N_API_KEY manquant.",
      leadFormSmsWorkflow: {
        key: LEAD_FORM_SMS_WORKFLOW_KEY,
        name: LEAD_FORM_SMS_WORKFLOW_NAME,
        found: false,
      },
      leadFormMultichannelWorkflow: {
        key: LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY,
        name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME,
        found: false,
      },
      leadFormQualificationRoutingWorkflow: {
        key: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY,
        name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME,
        found: false,
      },
      inboundCallReceptionWorkflow: {
        key: INBOUND_CALL_RECEPTION_WORKFLOW_KEY,
        name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME,
        found: false,
      },
      retellAssurancePhoneAgentWorkflow: {
        key: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY,
        name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME,
        found: false,
      },
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-N8N-API-KEY": apiKey,
      },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        ...config,
        apiReachable: false,
        checkedAt,
        error: `API n8n non joignable (${response.status}).`,
        leadFormSmsWorkflow: {
          key: LEAD_FORM_SMS_WORKFLOW_KEY,
          name: LEAD_FORM_SMS_WORKFLOW_NAME,
          found: false,
        },
        leadFormMultichannelWorkflow: {
          key: LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY,
          name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME,
          found: false,
        },
        leadFormQualificationRoutingWorkflow: {
          key: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY,
          name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME,
          found: false,
        },
        inboundCallReceptionWorkflow: {
          key: INBOUND_CALL_RECEPTION_WORKFLOW_KEY,
          name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME,
          found: false,
        },
        retellAssurancePhoneAgentWorkflow: {
          key: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY,
          name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME,
          found: false,
        },
      }
    }

    return {
      ...config,
      apiReachable: true,
      checkedAt,
      leadFormSmsWorkflow: await getLeadFormSmsWorkflowStatus(),
      leadFormMultichannelWorkflow: await getLeadFormMultichannelWorkflowStatus(),
      leadFormQualificationRoutingWorkflow: await getLeadFormQualificationRoutingWorkflowStatus(),
      inboundCallReceptionWorkflow: await getInboundCallReceptionWorkflowStatus(),
      retellAssurancePhoneAgentWorkflow: await getRetellAssurancePhoneAgentWorkflowStatus(),
    }
  } catch (error) {
    return {
      ...config,
      apiReachable: false,
      checkedAt,
      error: safeError(error),
      leadFormSmsWorkflow: {
        key: LEAD_FORM_SMS_WORKFLOW_KEY,
        name: LEAD_FORM_SMS_WORKFLOW_NAME,
        found: false,
        lastError: safeError(error),
      },
      leadFormMultichannelWorkflow: {
        key: LEAD_FORM_MULTICHANNEL_WORKFLOW_KEY,
        name: LEAD_FORM_MULTICHANNEL_WORKFLOW_NAME,
        found: false,
        lastError: safeError(error),
      },
      leadFormQualificationRoutingWorkflow: {
        key: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_KEY,
        name: LEAD_FORM_QUALIFICATION_ROUTING_WORKFLOW_NAME,
        found: false,
        lastError: safeError(error),
      },
      inboundCallReceptionWorkflow: {
        key: INBOUND_CALL_RECEPTION_WORKFLOW_KEY,
        name: INBOUND_CALL_RECEPTION_WORKFLOW_NAME,
        found: false,
        lastError: safeError(error),
      },
      retellAssurancePhoneAgentWorkflow: {
        key: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_KEY,
        name: RETELL_ASSURANCE_PHONE_AGENT_WORKFLOW_NAME,
        found: false,
        lastError: safeError(error),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}
