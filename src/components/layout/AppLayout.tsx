import { redirect } from "next/navigation"
import Link from "next/link"

import { AppLayoutClient } from "@/components/layout/AppLayoutClient"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { homePathForUserRole } from "@/lib/auth/app-roles"
import { canAccessModule, modulesForSubscription, normalizeSubscriptionPlan, subscriptionPlans, type ModuleKey } from "@/lib/billing/plans"
import { prisma } from "@/lib/prisma"

type AppLayoutProps = {
  children: React.ReactNode
  moduleKey?: ModuleKey
}

export async function AppLayout({ children, moduleKey }: AppLayoutProps) {
  const user = await getCurrentUserWithOrg()

  if (!user) {
    redirect("/sign-in")
  }

  if (user.role === "DEVELOPER" || user.role === "CLIENT") {
    redirect(homePathForUserRole(user.role))
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      moduleAccess: true,
    },
  })
  const subscriptionPlan = normalizeSubscriptionPlan(organization?.subscriptionPlan)
  const subscriptionStatus = organization?.subscriptionStatus ?? "ACTIVE"
  const moduleAccess = organization?.moduleAccess
  const allowedModuleKeys = modulesForSubscription(subscriptionPlan, moduleAccess)
  const canOpenModule = !moduleKey || canAccessModule({
    plan: subscriptionPlan,
    status: subscriptionStatus,
    moduleAccess,
    moduleKey,
  })
  const [firstName, ...lastNameParts] = user.name.split(" ").filter(Boolean)

  return (
    <AppLayoutClient
      initialAdvisorProfile={{
        id: user.id,
        firstName: firstName || user.name || "Conseiller",
        lastName: lastNameParts.join(" "),
        title: user.title ?? "Espace sécurisé",
        email: user.email,
        phone: user.phone ?? "",
        specialties: user.specialties ?? "",
        zones: user.routingTerritories ?? "",
        language: user.routingLanguages ?? "Français",
        licenseNumber: user.licenseNumber ?? "",
        avatarUrl: user.avatarUrl ?? "",
      }}
      allowedModuleKeys={allowedModuleKeys}
    >
      {canOpenModule ? children : (
        <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center">
          <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-amber-700">Module non inclus</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Ce module n’est pas disponible dans le forfait {subscriptionPlans[subscriptionPlan].label}.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              L’accès est contrôlé par l’administrateur développeur. Change le forfait ou ajoute ce module dans la console développeur pour l’activer pour ce cabinet.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                Retour au tableau de bord
              </Link>
              <Link href="/parametres" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Paramètres
              </Link>
            </div>
          </div>
        </section>
      )}
    </AppLayoutClient>
  )
}
