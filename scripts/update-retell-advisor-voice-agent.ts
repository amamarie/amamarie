import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const RETELL_API_BASE = "https://api.retellai.com"

const advisorPromptSection = `

PARAMETRES PERSONNALISES DU CONSEILLER
FinAdvisor peut envoyer des variables dynamiques propres au conseiller assigne.

Variables disponibles:
- advisor_greeting: message d'accueil a utiliser au debut si fourni.
- advisor_sms_notice: SMS de preavis deja envoye au client.
- advisor_tone: ton attendu pour la conversation.
- advisor_language: langue preferee.
- advisor_availability: disponibilites ou regles de disponibilite a annoncer.
- advisor_qualification_type: type de qualification a privilegier.
- advisor_booking_link: lien de rendez-vous du conseiller.
- advisor_specialties: specialites du conseiller.
- advisor_custom_instructions: consignes additionnelles du conseiller.

Regles:
- Commence avec advisor_greeting lorsque la variable est presente.
- Adapte ton style selon advisor_tone sans devenir familier.
- Tiens compte de advisor_specialties et advisor_qualification_type pour choisir les questions de prequalification.
- Si le client veut un rendez-vous, mentionne le lien advisor_booking_link seulement s'il est fourni, puis recueille aussi ses disponibilites.
- Respecte advisor_availability lorsque tu proposes une suite.
- Applique advisor_custom_instructions uniquement si elles restent conformes aux limites de ton role.
- Ne donne jamais de recommandation d'assurance, de placement, fiscale, juridique ou financiere.
`.trim()

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is missing`)
  return value
}

async function retellFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${RETELL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("RETELL_API_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(payload)}`)
  }
  return payload
}

function dedupeAnalysisData(items: unknown) {
  if (!Array.isArray(items)) return undefined
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false
    const name = "name" in item ? String(item.name) : ""
    if (!name || seen.has(name)) return false
    seen.add(name)
    return true
  })
}

function updateEnvFile(values: Record<string, string>) {
  const envPath = resolve(process.cwd(), ".env.local")
  let content = readFileSync(envPath, "utf8")
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}="${value}"`
    const pattern = new RegExp(`^${key}=.*$`, "m")
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`
  }
  writeFileSync(envPath, content)
}

async function main() {
  const currentAgentId = requireEnv("RETELL_AGENT_ID")
  const currentLlmId = requireEnv("RETELL_LLM_ID")

  const currentAgent = await retellFetch(`/get-agent/${encodeURIComponent(currentAgentId)}`)
  const currentLlm = await retellFetch(`/get-retell-llm/${encodeURIComponent(currentLlmId)}`)
  const currentPrompt = String(currentLlm.general_prompt ?? "")
  const nextPrompt = currentPrompt.includes("advisor_greeting")
    ? currentPrompt
    : `${currentPrompt.trim()}\n\n${advisorPromptSection}`

  const newLlm = await retellFetch("/create-retell-llm", {
    method: "POST",
    body: JSON.stringify({
      model: currentLlm.model ?? "gpt-4.1-mini",
      model_temperature: currentLlm.model_temperature ?? 0.1,
      general_prompt: nextPrompt,
      general_tools: currentLlm.general_tools ?? [],
      start_speaker: currentLlm.start_speaker ?? "agent",
      begin_message: currentLlm.begin_message,
      kb_config: currentLlm.kb_config,
    }),
  })

  const newAgent = await retellFetch("/create-agent", {
    method: "POST",
    body: JSON.stringify({
      agent_name: "FinAdvisor - Emma - Assistant assurance - parametres conseiller",
      response_engine: {
        type: "retell-llm",
        llm_id: newLlm.llm_id,
        version: 0,
      },
      voice_id: currentAgent.voice_id ?? "cartesia-Emma",
      language: currentAgent.language ?? "fr-CA",
      webhook_url: currentAgent.webhook_url,
      webhook_events: currentAgent.webhook_events,
      data_storage_setting: currentAgent.data_storage_setting,
      data_storage_retention_days: currentAgent.data_storage_retention_days,
      end_call_after_silence_ms: currentAgent.end_call_after_silence_ms,
      max_call_duration_ms: currentAgent.max_call_duration_ms,
      interruption_sensitivity: currentAgent.interruption_sensitivity,
      enable_backchannel: currentAgent.enable_backchannel,
      normalize_for_speech: currentAgent.normalize_for_speech,
      allow_user_dtmf: currentAgent.allow_user_dtmf,
      user_dtmf_options: currentAgent.user_dtmf_options,
      timezone: currentAgent.timezone,
      post_call_analysis_model: currentAgent.post_call_analysis_model,
      analysis_successful_prompt: currentAgent.analysis_successful_prompt,
      analysis_summary_prompt: currentAgent.analysis_summary_prompt,
      post_call_analysis_data: dedupeAnalysisData(currentAgent.post_call_analysis_data),
      pii_config: currentAgent.pii_config,
      opt_in_signed_url: currentAgent.opt_in_signed_url,
    }),
  })

  try {
    await retellFetch(`/publish-agent-version/${encodeURIComponent(newAgent.agent_id)}`, {
      method: "POST",
      body: JSON.stringify({ version: 0 }),
    })
  } catch {
    // Some Retell workspaces publish newly created agents automatically.
  }

  updateEnvFile({
    RETELL_LLM_ID: newLlm.llm_id,
    RETELL_AGENT_ID: newAgent.agent_id,
  })

  console.log(JSON.stringify({
    llm_id: newLlm.llm_id,
    agent_id: newAgent.agent_id,
    voice_id: newAgent.voice_id,
    hasAdvisorVariables: nextPrompt.includes("advisor_greeting"),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
