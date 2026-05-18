import Link from "next/link"
import { CalendarDays, UserRoundCheck } from "lucide-react"

import { prisma } from "@/lib/prisma"

const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

function minutesLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

export default async function CabinetBookingPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      users: {
        where: { role: { in: ["OWNER", "ADVISOR"] } },
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          availabilitySlots: {
            where: { isActive: true },
            select: { id: true, dayOfWeek: true, startMinutes: true, endMinutes: true, label: true },
            orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!organization) {
    return (
      <main className="min-h-screen bg-[#F7FCEB] p-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border-2 border-rose-200 bg-white p-8 text-center font-black text-rose-700 shadow-[0_12px_0_#fecdd3]">
          Calendrier cabinet indisponible.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F7FCEB] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border-2 border-emerald-200 bg-white p-6 shadow-[0_12px_0_#d9f99d]">
        <div className="flex items-start gap-4">
          <div className="grid size-14 place-items-center rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700">
            <CalendarDays className="size-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{organization.name}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Choisir un conseiller</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">Sélectionnez un conseiller pour voir uniquement ses créneaux disponibles. Les rendez-vous privés ne sont jamais affichés.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {organization.users.map((advisor) => {
            const hasSlots = advisor.availabilitySlots.length > 0

            return (
              <div
                key={advisor.id}
                className="rounded-[1.5rem] border-2 border-slate-200 bg-slate-50 p-5 shadow-[0_6px_0_#e2e8f0]"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-white text-emerald-700 ring-2 ring-emerald-100">
                    <UserRoundCheck className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-950">{advisor.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{advisor.title ?? advisor.email}</p>
                    <p className={`mt-3 text-xs font-black uppercase tracking-[0.12em] ${hasSlots ? "text-emerald-700" : "text-amber-700"}`}>
                      {hasSlots ? `${advisor.availabilitySlots.length} plage(s) publiée(s)` : "Aucune plage publiée"}
                    </p>
                    {hasSlots ? (
                      <div className="mt-3 grid gap-2">
                        {advisor.availabilitySlots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-emerald-100 bg-white px-3 py-2 text-sm font-black text-slate-800">
                            <span>{slot.label ?? dayNames[slot.dayOfWeek]}</span>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
                              {minutesLabel(slot.startMinutes)} - {minutesLabel(slot.endMinutes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                        Ce conseiller doit publier ses disponibilités avant de recevoir des réservations automatiques.
                      </p>
                    )}
                    <Link
                      href={`/rendez-vous/${advisor.id}#creneaux`}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-[0_4px_0_#16a34a] transition hover:-translate-y-0.5"
                    >
                      {hasSlots ? "Voir les créneaux disponibles" : "Ouvrir la demande de rendez-vous"}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
