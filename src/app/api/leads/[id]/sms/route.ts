import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { sendSmsFromCrm } from "@/lib/services/communications"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { smsSendErrorMessage } from "@/lib/twilio/errors"

type RouteContext = {
  params: Promise<{ id: string }>
}

const sendMockSmsSchema = z.object({
  body: z.string().min(1, "Le message est requis"),
})

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const data = sendMockSmsSchema.parse(await request.json())

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    const sms = await sendSmsFromCrm({ user: { id: userId, organizationId }, to: lead.phone, body: data.body, leadId: lead.id })

    return NextResponse.json({ data: sms }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: smsSendErrorMessage(error) },
      { status: 400 }
    )
  }
}
