import { prisma } from "@/lib/prisma"

export async function getOwnedCall({ organizationId, callId }: { organizationId: string; callId: string }) {
  const call = await prisma.callLog.findFirst({
    where: { id: callId, organizationId },
    include: { transcription: true, client: true, lead: true },
  })
  if (!call) throw new Error("CALL_NOT_FOUND")
  return call
}
