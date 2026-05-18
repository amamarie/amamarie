import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { runAutomationsForEvent, createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { routeLeadFromFormQualification } from "@/lib/services/lead-routing"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

export async function POST(request: Request) {
  try {
    const user = await requireOwner()
    const body = await request.json().catch(() => ({})) as { phone?: string; email?: string; message?: string; interestType?: string }
    const phone = normalizePhoneNumber(body.phone) || "+15145550123"
    const email = body.email?.trim() || "test-formulaire@finadvisor.local"
    const interestType = body.interestType?.trim() || "Assurance vie"
    const message = body.message?.trim() || "Bonjour, je veux une assurance vie rapidement. Budget environ 150 $ par mois, protection familiale et hypothèque."

    const lead = await prisma.lead.create({
      data: {
        organizationId: user.organizationId,
        advisorId: user.id,
        firstName: "Test",
        lastName: "Formulaire n8n",
        email,
        phone,
        source: "WEBSITE",
        status: "NEW",
        priority: "HIGH",
        interestType,
        nextAction: "Vérifier le test formulaire → n8n → qualification → routage",
        notes: message,
      },
    })
    const leadForm = await prisma.leadForm.findFirst({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    })
    const submission = leadForm
      ? await prisma.leadFormSubmission.create({
          data: {
            organizationId: user.organizationId,
            advisorId: user.id,
            leadFormId: leadForm.id,
            leadId: lead.id,
            payload: {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              interestType: lead.interestType,
              message,
              consent: true,
            },
          },
        })
      : null

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      leadId: lead.id,
      type: "LEAD_CREATED",
      title: "Prospect test formulaire créé",
      description: "Déclenchement test formulaire → n8n → SMS.",
      entityType: "Lead",
      entityId: lead.id,
      source: "USER",
    })

    const result = await runAutomationsForEvent({
      organizationId: user.organizationId,
      userId: user.id,
      leadId: lead.id,
      event: "LEAD_CREATED",
      title: "Prospect test créé depuis formulaire",
      description: "Test automatisation formulaire n8n.",
      payload: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        interestType: lead.interestType,
        message,
        source: "lead_form",
        leadFormId: leadForm?.id ?? "test",
        submissionId: submission?.id ?? "test",
      },
    })

    const routedLead = await prisma.lead.findFirst({
      where: { id: lead.id, organizationId: user.organizationId },
      select: {
        id: true,
        priority: true,
        nextAction: true,
        advisor: { select: { id: true, name: true, email: true, specialties: true } },
      },
    })

    const hasRoutingActivity = await prisma.activity.findFirst({
      where: {
        organizationId: user.organizationId,
        leadId: lead.id,
        title: { contains: "routage", mode: "insensitive" },
      },
      select: { id: true },
    })

    let localRoutingFallback: Awaited<ReturnType<typeof routeLeadFromFormQualification>> | null = null
    if (!hasRoutingActivity) {
      localRoutingFallback = await routeLeadFromFormQualification({
        organizationId: user.organizationId,
        leadId: lead.id,
        userId: user.id,
        workflowKey: "lead.form.local_test_routing_fallback",
        detectedNeed: interestType,
        urgency: "HIGH",
        budget: "150 $ / mois",
        rationale: "Fallback local du test: le callback n8n de routage n’a pas encore été observé.",
      })
    }

    const tasks = await prisma.task.findMany({
      where: { organizationId: user.organizationId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, priority: true, assignedTo: { select: { id: true, name: true } } },
    })
    const activities = await prisma.activity.findMany({
      where: { organizationId: user.organizationId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, type: true, createdAt: true },
    })

    return ok({
      lead: { id: lead.id, name: `${lead.firstName} ${lead.lastName}`, phone: lead.phone, email: lead.email },
      leadForm,
      submission: submission ? { id: submission.id } : null,
      automation: result,
      routing: {
        advisorId: routedLead?.advisor?.id ?? localRoutingFallback?.advisorId ?? null,
        advisorName: routedLead?.advisor?.name ?? localRoutingFallback?.advisorName ?? null,
        advisorSpecialties: routedLead?.advisor?.specialties ?? null,
        priority: routedLead?.priority ?? null,
        nextAction: routedLead?.nextAction ?? null,
        fallbackUsed: Boolean(localRoutingFallback),
      },
      tasks,
      activities,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
