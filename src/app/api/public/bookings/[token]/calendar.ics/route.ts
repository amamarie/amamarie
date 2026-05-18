import { NextResponse } from "next/server"

import { bookingIcs } from "@/lib/calendar/public-calendar-links"
import { prisma } from "@/lib/prisma"

function publicAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const origin = new URL(request.url).origin
  return origin.replace("://0.0.0.0:", "://localhost:")
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const booking = await prisma.booking.findFirst({
    where: {
      status: "CONFIRMED",
      OR: [
        { cancellationToken: token },
        { rescheduleToken: token },
      ],
    },
    include: {
      advisor: { select: { name: true, email: true } },
    },
  })

  if (!booking) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Ce rendez-vous est introuvable." } }, { status: 404 })
  }

  return new NextResponse(bookingIcs(booking, publicAppOrigin(request)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rendez-vous-${booking.id}.ics"`,
      "Cache-Control": "no-store",
    },
  })
}
