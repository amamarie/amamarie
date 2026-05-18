import type { Prisma } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"

type DefaultChecklistItem = {
  label: string
  description?: string
  required?: boolean
  blocking?: boolean
  evidenceRequired?: boolean
}

type DefaultChecklist = {
  productType: string
  name: string
  version: string
  description: string
  items: DefaultChecklistItem[]
}

export const defaultComplianceChecklists: DefaultChecklist[] = [
  {
    productType: "ASSURANCE_VIE",
    name: "Assurance vie - dossier complet",
    version: "1.0",
    description: "Checklist de conformité pour une recommandation d’assurance vie individuelle ou familiale.",
    items: [
      { label: "KYC confirmé", description: "Le profil client utilisé pour la recommandation est confirmé et à jour.", blocking: true },
      { label: "Analyse des besoins complétée", description: "L’analyse couvre revenus, dettes, objectifs, protections existantes et besoins familiaux.", blocking: true },
      { label: "Revenus documentés", description: "Le revenu déclaré est appuyé par une source ou une note de justification.", evidenceRequired: true },
      { label: "Dettes et hypothèque confirmées", description: "Les soldes utilisés pour le calcul de protection sont documentés.", evidenceRequired: true },
      { label: "Protections existantes révisées", description: "Les polices existantes, collectives ou personnelles sont vérifiées.", blocking: true, evidenceRequired: true },
      { label: "Bénéficiaires confirmés", description: "Les bénéficiaires et besoins successoraux pertinents sont documentés." },
      { label: "Objectif de protection documenté", description: "L’objectif client est clair : famille, dette, remplacement de revenu, fiscalité ou succession.", blocking: true },
      { label: "Options analysées", description: "Les alternatives pertinentes ont été considérées et résumées.", blocking: true },
      { label: "Recommandation justifiée", description: "Montant, durée, type de produit et budget sont justifiés.", blocking: true },
      { label: "Illustration ou sommaire remis", description: "Les documents de produit applicables ont été remis.", evidenceRequired: true },
      { label: "Limites et exclusions expliquées", description: "Les exclusions, limites, primes et conditions importantes ont été expliquées." },
      { label: "Rapport remis au client", description: "La preuve de remise du rapport est conservée.", blocking: true, evidenceRequired: true },
      { label: "Consentements signés", description: "Les consentements collecte, analyse, documents et communication applicable sont actifs.", blocking: true },
    ],
  },
  {
    productType: "INVALIDITE",
    name: "Assurance invalidité - dossier complet",
    version: "1.0",
    description: "Checklist pour documenter le besoin, le revenu assurable et les protections existantes.",
    items: [
      { label: "Revenu validé", description: "Le revenu utilisé est vérifié ou justifié.", blocking: true, evidenceRequired: true },
      { label: "Statut d’emploi confirmé", description: "Employé, autonome, incorporé ou propriétaire d’entreprise." },
      { label: "Protection collective vérifiée", description: "La protection collective existante est connue ou l’absence est documentée.", blocking: true, evidenceRequired: true },
      { label: "Dépenses essentielles connues", description: "Les dépenses mensuelles nécessaires sont documentées." },
      { label: "Fonds d’urgence évalué", description: "Le coussin disponible et la liquidité sont considérés." },
      { label: "Délai de carence discuté", description: "Le délai recommandé est lié au fonds d’urgence et au budget." },
      { label: "Durée de prestation discutée", description: "La durée recommandée est expliquée au client." },
      { label: "Définition d’invalidité expliquée", description: "Les notions emploi propre, tout emploi ou définitions applicables sont expliquées." },
      { label: "Recommandation justifiée", description: "Montant, délai, durée et définition sont justifiés.", blocking: true },
      { label: "Rapport remis", description: "La remise au client est journalisée.", blocking: true, evidenceRequired: true },
    ],
  },
  {
    productType: "PLACEMENT",
    name: "Placement - convenance et profil investisseur",
    version: "1.0",
    description: "Checklist pour les dossiers de placement, profil de risque et convenance.",
    items: [
      { label: "KYC confirmé", description: "Le profil utilisé est confirmé et non expiré.", blocking: true },
      { label: "Objectif documenté", description: "L’objectif de placement est clair et lié au dossier.", blocking: true },
      { label: "Horizon documenté", description: "L’horizon de placement est documenté.", blocking: true },
      { label: "Besoin de liquidité documenté", description: "Les besoins de retrait, réserve ou liquidité sont documentés." },
      { label: "Tolérance au risque évaluée", description: "La tolérance au risque est évaluée et cohérente.", blocking: true },
      { label: "Capacité de risque évaluée", description: "La capacité financière à assumer les pertes est évaluée.", blocking: true },
      { label: "Profil final confirmé", description: "Le profil final est confirmé ou toute divergence est justifiée.", blocking: true },
      { label: "Stratégie compatible", description: "Le produit ou portefeuille recommandé correspond au profil.", blocking: true },
      { label: "Frais expliqués", description: "Les frais, commissions ou coûts intégrés sont expliqués." },
      { label: "Risques expliqués", description: "Les principaux risques sont expliqués au client." },
      { label: "Alternatives considérées", description: "Les alternatives pertinentes ont été considérées." },
      { label: "Rapport de convenance généré", description: "Le rapport est généré, remis et conservé.", blocking: true, evidenceRequired: true },
    ],
  },
  {
    productType: "REMPLACEMENT_CONTRAT",
    name: "Remplacement de contrat - analyse comparative",
    version: "1.0",
    description: "Checklist renforcée pour remplacement de police ou contrat existant.",
    items: [
      { label: "Ancien contrat téléversé", description: "Le contrat existant est versé au coffre documentaire.", blocking: true, evidenceRequired: true },
      { label: "Nouveau contrat ou proposition documenté", description: "La proposition ou illustration est disponible.", blocking: true, evidenceRequired: true },
      { label: "Avantages comparés", description: "Les avantages du remplacement sont documentés.", blocking: true },
      { label: "Désavantages comparés", description: "Les pertes, coûts, délais ou garanties perdues sont documentés.", blocking: true },
      { label: "Pertes potentielles expliquées", description: "Les conséquences négatives possibles ont été expliquées au client.", blocking: true },
      { label: "Exclusions comparées", description: "Les exclusions et restrictions de chaque contrat sont comparées." },
      { label: "Préavis requis complété", description: "Le formulaire ou préavis applicable est complété.", blocking: true, evidenceRequired: true },
      { label: "Client a reçu les explications", description: "La preuve de remise ou confirmation est conservée.", blocking: true, evidenceRequired: true },
      { label: "Justification du remplacement ajoutée", description: "Le conseiller documente pourquoi le remplacement est approprié.", blocking: true },
      { label: "Approbation conformité obtenue", description: "Une revue conformité est complétée lorsque requise.", blocking: true },
    ],
  },
]

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function ensureDefaultComplianceChecklists({
  organizationId,
  userId,
}: {
  organizationId: string
  userId?: string | null
}) {
  const result = {
    created: 0,
    skipped: 0,
    checklists: [] as Array<{ id: string; name: string; productType: string; created: boolean }>,
  }

  for (const checklist of defaultComplianceChecklists) {
    const existing = await prisma.productChecklist.findFirst({
      where: {
        organizationId,
        productType: checklist.productType,
        name: checklist.name,
        version: checklist.version,
      },
      select: { id: true, name: true, productType: true },
    })

    if (existing) {
      result.skipped += 1
      result.checklists.push({ ...existing, created: false })
      continue
    }

    const created = await prisma.productChecklist.create({
      data: {
        organizationId,
        createdById: userId,
        approvedById: userId,
        approvedAt: new Date(),
        productType: checklist.productType,
        name: checklist.name,
        version: checklist.version,
        description: checklist.description,
        active: true,
        items: {
          create: checklist.items.map((item, index) => ({
            organizationId,
            label: item.label,
            description: item.description ?? null,
            required: item.required !== false,
            blocking: Boolean(item.blocking),
            evidenceRequired: Boolean(item.evidenceRequired),
            orderIndex: index,
          })),
        },
      },
      select: { id: true, name: true, productType: true },
    })

    await createAuditLog({
      organizationId,
      userId,
      entityType: "ProductChecklist",
      entityId: created.id,
      action: "DEFAULT_PRODUCT_CHECKLIST_INSTALLED",
      newValue: json({ productType: checklist.productType, name: checklist.name, version: checklist.version, items: checklist.items.length }),
    })

    result.created += 1
    result.checklists.push({ ...created, created: true })
  }

  return result
}
