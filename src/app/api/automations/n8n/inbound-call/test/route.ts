import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { runAutomationsForEvent, createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

export async function POST(request: Request) {
  try {
    const user = await requireOwner()
    const body = await request.json().catch(() => ({})) as { phone?: string; to?: string }
    const fromNumber = normalizePhoneNumber(body.phone) || "+15145550124"
    const toNumber = normalizePhoneNumber(body.to) || "+15145550123"

    const lead = await prisma.lead.create({
      data: {
        organizationId: user.organizationId,
        advisorId: user.id,
        firstName: "Test",
        lastName: "Appel n8n",
        phone: fromNumber,
        source: "INBOUND_CALL",
        status: "NEW",
        priority: "HIGH",
        nextAction: "Vérifier la réception d’appel automatisée n8n",
        notes: "Prospect technique utilisé pour tester la réception d’appel n8n.",
      },
    })

    const call = await prisma.callLog.create({
      data: {
        organizationId: user.organizationId,
        leadId: lead.id,
        advisorId: user.id,
        direction: "INBOUND",
        status: "RINGING",
        fromNumber,
        toNumber,
        phoneNumber: fromNumber,
        twilioCallSid: `test-n8n-call-${Date.now()}`,
        matchedEntityType: "LEAD",
        matchedEntityId: lead.id,
      },
    })

    await createCrmActivity({
      organizationId: user.organizationId,
      userId: user.id,
      leadId: lead.id,
      type: "CALL_RECEIVED",
      title: "Appel test n8n reçu",
      description: fromNumber,
      entityType: "CallLog",
      entityId: call.id,
      source: "USER",
    })

    const automation = await runAutomationsForEvent({
      organizationId: user.organizationId,
      userId: user.id,
      leadId: lead.id,
      event: "INBOUND_CALL_RECEIVED",
      title: "Appel entrant test n8n",
      description: fromNumber,
      entityType: "call",
      entityId: call.id,
      payload: {
        callId: call.id,
        callSid: call.twilioCallSid,
        phone: fromNumber,
        fromNumber,
        toNumber,
        leadId: lead.id,
        advisorId: user.id,
        matchedEntityType: "LEAD",
        matchedEntityId: lead.id,
        callerName: `${lead.firstName} ${lead.lastName}`,
      },
    })

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
      lead: { id: lead.id, name: `${lead.firstName} ${lead.lastName}`, phone: lead.phone },
      call: { id: call.id, status: call.status, fromNumber: call.fromNumber },
      automation,
      tasks,
      activities,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
