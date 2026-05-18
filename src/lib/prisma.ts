import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const requiredDelegates = [
  "developerApiKey",
  "developerWebhook",
  "saasInvoice",
  "saasPayment",
  "superAdminTicket",
  "superAdminNote",
  "saasAddOn",
  "featureFlag",
] as const

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.")
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
}

function isCurrentPrismaClient(client: PrismaClient | undefined) {
  if (!client) return false

  const delegates = client as unknown as Record<string, unknown>
  return requiredDelegates.every((delegate) => delegates[delegate])
}

if (!isCurrentPrismaClient(globalForPrisma.prisma)) {
  globalForPrisma.prisma?.$disconnect().catch(() => null)
  globalForPrisma.prisma = createPrismaClient()
}

export const prisma: PrismaClient = globalForPrisma.prisma!

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
