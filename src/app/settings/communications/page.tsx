import { PageShell } from "@/components/crm/page-shell"
import { AdvisorCallerIdSettings } from "@/components/communications/AdvisorCallerIdSettings"
import { AdvisorVoiceAutomationSettings } from "@/components/communications/AdvisorVoiceAutomationSettings"
import { CommunicationSettingsForm } from "@/components/communications/CommunicationSettingsForm"

export default function CommunicationSettingsPage() {
  return (
    <PageShell eyebrow="Paramètres" title="Communications Twilio" description="Configurez le numéro Twilio, les réponses automatiques et la création automatique de prospects.">
      <div className="space-y-6">
        <AdvisorVoiceAutomationSettings />
        <CommunicationSettingsForm />
        <AdvisorCallerIdSettings />
      </div>
    </PageShell>
  )
}
