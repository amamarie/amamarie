import { createHmac } from "node:crypto"

import type { RunAutomationsInput } from "@/lib/automation/types"

type WorkflowInvokeInput = {
  workflowKey: string
  required?: boolean
  input: RunAutomationsInput
  params?: Record<string, unknown>
}

type WorkflowRuntimeStatus = {
  configured: boolean
  baseUrlConfigured: boolean
  secretConfigured: boolean
  timeoutMs: number
}

function envValue(name: string) {
  return process.env[name]?.trim() || undefined
}

function workflowEnvName(workflowKey: string) {
  return `N8N_WORKFLOW_${workflowKey.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase()}_URL`
}

function workflowBaseUrl() {
  return envValue("N8N_AUTOMATION_WEBHOOK_BASE_URL") ?? envValue("N8N_WEBHOOK_BASE_URL")
}

export function workflowSecret() {
  return envValue("N8N_AUTOMATION_WEBHOOK_SECRET") ?? envValue("N8N_WEBHOOK_SECRET")
}

function workflowTimeoutMs() {
  const value = Number(envValue("N8N_AUTOMATION_TIMEOUT_MS") ?? 8000)
  return Number.isFinite(value) && value > 0 ? value : 8000
}

function appBaseUrl() {
  return envValue("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") ?? envValue("APP_URL")?.replace(/\/$/, "")
}

function workflowUrl(workflowKey: string) {
  const directUrl = envValue(workflowEnvName(workflowKey))
  if (directUrl) return directUrl

  const baseUrl = workflowBaseUrl()
  if (!baseUrl) return undefined

  const normalized = baseUrl.replace(/\/$/, "")
  if (normalized.includes("{workflowKey}")) {
    return normalized.replace("{workflowKey}", encodeURIComponent(workflowKey))
  }

  return `${normalized}/${encodeURIComponent(workflowKey)}`
}

function signatureFor(body: string) {
  const secret = workflowSecret()
  if (!secret) return undefined
  return createHmac("sha256", secret).update(body).digest("hex")
}

export function getWorkflowRuntimeStatus(): WorkflowRuntimeStatus {
  return {
    configured: Boolean(workflowBaseUrl() || Object.keys(process.env).some((key) => key.startsWith("N8N_WORKFLOW_") && key.endsWith("_URL"))),
    baseUrlConfigured: Boolean(workflowBaseUrl()),
    secretConfigured: Boolean(workflowSecret()),
    timeoutMs: workflowTimeoutMs(),
  }
}

export async function invokeWorkflow({ workflowKey, required = false, input, params }: WorkflowInvokeInput) {
  const url = workflowUrl(workflowKey)
  if (!url) {
    if (required) throw new Error("WORKFLOW_RUNTIME_NOT_CONFIGURED")
    console.info({ action: "workflow_skipped", reason: "runtime_not_configured", workflowKey })
    return { skipped: true, reason: "runtime_not_configured" }
  }

  const body = JSON.stringify({
    source: "finadvisor-crm",
    workflowKey,
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    trigger: input.trigger,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    leadId: input.leadId ?? null,
    clientId: input.clientId ?? null,
    automationRuleId: input.automationRuleId ?? null,
    payload: input.payload ?? {},
    params: params ?? {},
    callback: appBaseUrl()
      ? {
          url: `${appBaseUrl()}/api/webhooks/n8n/finadvisor`,
          token: workflowSecret() ?? null,
        }
      : null,
    requestedAt: new Date().toISOString(),
  })
  const signature = signatureFor(body)
  const controller = new AbortController()
  const timeout = windowlessSetTimeout(() => controller.abort(), workflowTimeoutMs())

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FinAssuro-CRM-Automations/1.0",
        "X-FinAssuro-Source": "automation",
        "X-FinAssuro-Workflow": workflowKey,
        "X-FinAssuro-Trigger": input.trigger,
        ...(signature ? { "X-FinAssuro-Signature": `sha256=${signature}` } : {}),
      },
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`WORKFLOW_RUNTIME_FAILED_${response.status}`)
    }

    return { skipped: false, status: response.status }
  } finally {
    clearTimeout(timeout)
  }
}

function windowlessSetTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms)
}
