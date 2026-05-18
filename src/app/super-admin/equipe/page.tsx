import { BadgeCheck, KeyRound, ShieldCheck, Users } from "lucide-react"

import { upsertInternalAdminProfile } from "@/app/developpeur/actions"
import { AdminCard, AdminEmpty, AdminMetric, AdminPill, SuperAdminHeader, SuperAdminIntro } from "@/components/super-admin/SuperAdminChrome"
import { requireSuperAdmin } from "@/lib/auth/super-admin"
import { formatShortDate } from "@/lib/developer-console"
import { prisma } from "@/lib/prisma"

const internalRoles = [
  { value: "OWNER", label: "Fondateur / Owner", access: "Accès total" },
  { value: "ADMIN_SAAS", label: "Admin SaaS", access: "Clients, plans, support, facturation" },
  { value: "SUPPORT_N1", label: "Support N1", access: "Comptes client, logs simples, tickets" },
  { value: "SUPPORT_N2", label: "Support N2", access: "Diagnostics, intégrations, emails" },
  { value: "SALES", label: "Commercial", access: "Forfaits, usage commercial, upsell" },
  { value: "PRODUCT", label: "Produit", access: "Usage, activation, feedback" },
  { value: "DEVELOPER_INTERNAL", label: "Développeur interne", access: "Logs techniques, API, webhooks" },
  { value: "FINANCE", label: "Finance", access: "Abonnements, factures, paiements, revenu récurrent" },
  { value: "SECURITY", label: "Sécurité / conformité", access: "Audit logs, accès, incidents" },
]

const rolePermissions = [
  ["Voir un compte client", "oui", "oui", "oui", "oui", "oui"],
  ["Modifier un abonnement", "non", "non", "limité", "oui", "oui"],
  ["Voir les factures", "non", "non", "oui", "oui", "oui"],
  ["Réinitialiser une intégration", "non", "oui", "non", "oui", "oui"],
  ["Voir les logs techniques", "limité", "oui", "non", "oui", "oui"],
  ["Mode assistance", "limité", "oui", "non", "oui", "oui"],
  ["Exporter des données", "non", "non", "non", "limité", "oui"],
]

export default async function SuperAdminTeamPage() {
  const user = await requireSuperAdmin()
  const internalUsers = await prisma.user.findMany({
    where: { role: "DEVELOPER" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    include: {
      internalAdminProfile: true,
      internalCredential: { select: { passwordUpdatedAt: true } },
    },
  })
  const activeProfiles = internalUsers.filter((member) => member.internalAdminProfile?.status !== "SUSPENDED")
  const twoFactorRequired = internalUsers.filter((member) => member.internalAdminProfile?.twoFactorRequired ?? true)
  const ipProtected = internalUsers.filter((member) => Boolean(member.internalAdminProfile?.ipAllowlist))

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <SuperAdminHeader userName={user.name} active="equipe" />
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SuperAdminIntro title="Équipe interne" description="Gestion des profils super admin, rôles internes, exigences 2FA et restrictions IP. Cette page reste réservée aux comptes développeur internes." />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric icon={Users} label="Admins internes" value={`${internalUsers.length}`} detail="Comptes développeur" tone="violet" />
          <AdminMetric icon={BadgeCheck} label="Profils actifs" value={`${activeProfiles.length}`} detail="Non suspendus" tone="emerald" />
          <AdminMetric icon={ShieldCheck} label="2FA exigée" value={`${twoFactorRequired.length}`} detail="Profils protégés" tone="amber" />
          <AdminMetric icon={KeyRound} label="IP allowlist" value={`${ipProtected.length}`} detail="Restrictions configurées" tone={ipProtected.length ? "emerald" : "slate"} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <AdminCard title="Profils internes" eyebrow="Accès super admin">
            <div className="mt-4 grid gap-3">
              {internalUsers.length === 0 ? <AdminEmpty>Aucun compte interne trouvé.</AdminEmpty> : internalUsers.map((member) => {
                const profile = member.internalAdminProfile
                return (
                  <form key={member.id} action={upsertInternalAdminProfile} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <input type="hidden" name="userId" value={member.id} />
                    <div className="grid gap-3 lg:grid-cols-[1fr_220px_150px_150px]">
                      <div>
                        <p className="font-semibold text-slate-950">{member.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{member.email}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">Mot de passe interne: {member.internalCredential?.passwordUpdatedAt ? formatShortDate(member.internalCredential.passwordUpdatedAt) : "non configuré"}</p>
                      </div>
                      <select name="internalRole" defaultValue={profile?.internalRole ?? "SUPPORT_N1"} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                        {internalRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                      <select name="status" defaultValue={profile?.status ?? "ACTIVE"} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                        <option value="ACTIVE">Actif</option>
                        <option value="SUSPENDED">Suspendu</option>
                        <option value="LIMITED">Limité</option>
                      </select>
                      <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                        <input type="checkbox" name="twoFactorRequired" defaultChecked={profile?.twoFactorRequired ?? true} className="size-4 rounded border-slate-300" />
                        2FA
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input name="ipAllowlist" defaultValue={profile?.ipAllowlist ?? ""} placeholder="IP allowlist, séparées par virgule" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-violet-300" />
                      <button className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-violet-700">Enregistrer</button>
                    </div>
                  </form>
                )
              })}
            </div>
          </AdminCard>

          <AdminCard title="Rôles recommandés" eyebrow="Matrice interne">
            <div className="mt-4 grid gap-3">
              {internalRoles.map((role) => (
                <div key={role.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-950">{role.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{role.access}</p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard title="Permissions internes détaillées" eyebrow="Contrôle d’accès" className="mt-4">
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Support N1</th>
                  <th className="px-3 py-2">Support N2</th>
                  <th className="px-3 py-2">Commercial</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rolePermissions.map((row) => (
                  <tr key={row[0]}>
                    <td className="px-3 py-3 font-semibold text-slate-950">{row[0]}</td>
                    {row.slice(1).map((value, index) => (
                      <td key={`${row[0]}-${index}`} className="px-3 py-3">
                        <AdminPill tone={value === "oui" ? "emerald" : value === "limité" ? "amber" : "slate"}>{value}</AdminPill>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </section>
    </main>
  )
}
