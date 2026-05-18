import { syncAdvancedKycArtifacts } from "../src/lib/compliance/kyc-advanced"
import { prisma } from "../src/lib/prisma"

async function main() {
  const profiles = await prisma.clientKycProfile.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: { client: { select: { id: true, advisorId: true, organizationId: true } } },
    orderBy: { updatedAt: "desc" },
  })

  let synced = 0
  const errors: Array<{ kycProfileId: string; message: string }> = []
  for (const profile of profiles) {
    try {
      await syncAdvancedKycArtifacts({
        organizationId: profile.organizationId,
        clientId: profile.clientId,
        userId: profile.client.advisorId,
        kyc: profile,
      })
      synced += 1
    } catch (error) {
      errors.push({
        kycProfileId: profile.id,
        message: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  console.log(JSON.stringify({ scanned: profiles.length, synced, errors }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
