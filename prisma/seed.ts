import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  ActivityType,
  FinancialProductCategory,
  FinancialProductStatus,
  FinancialProductType,
  LeadSource,
  LeadStatus,
  PrismaClient,
  Priority,
  TaskStatus,
  UserRole,
} from "@prisma/client"

import {
  DEMO_ORG_ID,
  DEMO_ORGANIZATION_SLUG,
  DEMO_USER_ID,
  demoAdvisor,
  demoOrganization,
} from "../src/lib/demo-context"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_ORGANIZATION_SLUG },
    update: {
      name: demoOrganization.name,
    },
    create: {
      id: DEMO_ORG_ID,
      name: demoOrganization.name,
      slug: DEMO_ORGANIZATION_SLUG,
    },
  })

  const demoUser = await prisma.user.upsert({
    where: { email: demoAdvisor.email },
    update: {
      organizationId: organization.id,
      name: demoAdvisor.name,
      role: UserRole.OWNER,
    },
    create: {
      id: DEMO_USER_ID,
      organizationId: organization.id,
      name: demoAdvisor.name,
      email: demoAdvisor.email,
      role: UserRole.OWNER,
    },
  })

  const alex = await prisma.user.upsert({
    where: { email: "alex.roy@finadvisor.ca" },
    update: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      name: "Alex Roy",
      email: "alex.roy@finadvisor.ca",
      role: UserRole.ADVISOR,
    },
  })

  await prisma.activity.deleteMany({ where: { organizationId: organization.id } })
  await prisma.notification.deleteMany({ where: { organizationId: organization.id } })
  await prisma.note.deleteMany({ where: { organizationId: organization.id } })
  await prisma.task.deleteMany({ where: { organizationId: organization.id } })
  await prisma.document.deleteMany({ where: { organizationId: organization.id } })
  await prisma.callLog.deleteMany({ where: { organizationId: organization.id } })
  await prisma.sMSMessage.deleteMany({ where: { organizationId: organization.id } })
  await prisma.automationRule.deleteMany({ where: { organizationId: organization.id } })
  await prisma.financialProduct.deleteMany({
    where: { client: { organizationId: organization.id } },
  })
  await prisma.lead.deleteMany({ where: { organizationId: organization.id } })
  await prisma.client.deleteMany({ where: { organizationId: organization.id } })

  const antoine = await prisma.lead.create({
    data: {
      organizationId: organization.id,
      advisorId: demoUser.id,
      firstName: "Antoine",
      lastName: "Leduc",
      phone: "+1 514 555 0198",
      email: "antoine.leduc@example.ca",
      address: "1280 rue Saint-Denis, Montreal, QC",
      source: LeadSource.INBOUND_CALL,
      status: LeadStatus.NEW,
      interestType: "Assurance vie",
      priority: Priority.URGENT,
      nextAction: "Rappeler aujourd hui avant 16:00",
      lastContactAt: new Date("2026-05-02T09:12:00-04:00"),
      notes:
        "Travailleur autonome, souhaite proteger sa conjointe et comparer les primes.",
    },
  })

  await prisma.lead.createMany({
    data: [
      {
        organizationId: organization.id,
        advisorId: demoUser.id,
        firstName: "Camille",
        lastName: "Fortin",
        phone: "+1 450 555 0142",
        email: "camille.fortin@example.ca",
        address: "44 chemin Chambly, Longueuil, QC",
        source: LeadSource.WEBSITE,
        status: LeadStatus.QUALIFIED,
        interestType: "REER et CELI",
        priority: Priority.HIGH,
        nextAction: "Envoyer proposition de plan d epargne",
        lastContactAt: new Date("2026-05-01T15:07:00-04:00"),
        notes: "Souhaite optimiser epargne retraite et liquidites moyen terme.",
      },
      {
        organizationId: organization.id,
        advisorId: alex.id,
        firstName: "Marc",
        lastName: "Nguyen",
        phone: "+1 438 555 0177",
        email: "marc.nguyen@example.ca",
        address: "730 avenue Laurier Ouest, Montreal, QC",
        source: LeadSource.REFERRAL,
        status: LeadStatus.TO_CONTACT,
        interestType: "Assurance invalidite",
        priority: Priority.NORMAL,
        nextAction: "Planifier appel decouverte",
        lastContactAt: new Date("2026-04-28T11:00:00-04:00"),
        notes: "Recommande par un client existant, professionnel en TI.",
      },
    ],
  })

  const sophie = await prisma.client.create({
    data: {
      organizationId: organization.id,
      advisorId: demoUser.id,
      firstName: "Sophie",
      lastName: "Tremblay",
      dateOfBirth: new Date("1984-09-12"),
      phone: "+1 514 555 0132",
      email: "sophie.tremblay@example.ca",
      address: "215 rue Beaubien Est, Montreal, QC",
      occupation: "Pharmacienne",
      employer: "Pharmacie Plateau Sante",
      approximateIncome: 145000,
      familyStatus: "Conjointe, 2 enfants",
      dependents: 2,
      riskProfile: "Modere",
      goals: "Protection familiale; Epargne retraite; Fonds d urgence",
      notes: "Revision annuelle requise avant renouvellement vie.",
    },
  })

  const karim = await prisma.client.create({
    data: {
      organizationId: organization.id,
      advisorId: demoUser.id,
      firstName: "Karim",
      lastName: "Haddad",
      dateOfBirth: new Date("1979-02-04"),
      phone: "+1 438 555 0188",
      email: "karim.haddad@example.ca",
      address: "18 rue Notre-Dame Ouest, Laval, QC",
      occupation: "Consultant independant",
      employer: "Haddad Strategie Inc.",
      approximateIncome: 180000,
      familyStatus: "Marie",
      dependents: 1,
      status: "REVIEW_NEEDED",
      riskProfile: "Eleve",
      goals: "Protection revenu; Optimisation fiscale",
      notes: "Document de profil client manquant et beneficiaire a confirmer.",
    },
  })

  await prisma.task.createMany({
    data: [
      {
        organizationId: organization.id,
        assignedToId: demoUser.id,
        leadId: antoine.id,
        title: "Rappeler Antoine Leduc",
        description: "Qualifier le besoin assurance vie et proposer un rendez-vous.",
        dueDate: new Date("2026-05-02T10:30:00-04:00"),
        priority: Priority.URGENT,
        status: TaskStatus.OVERDUE,
      },
      {
        organizationId: organization.id,
        assignedToId: demoUser.id,
        clientId: karim.id,
        title: "Envoyer formulaire profil client",
        dueDate: new Date("2026-05-02T14:00:00-04:00"),
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
      },
    ],
  })

  await prisma.financialProduct.create({
    data: {
      organizationId: organization.id,
      clientId: sophie.id,
      advisorId: demoUser.id,
      category: FinancialProductCategory.INSURANCE,
      type: FinancialProductType.LIFE_INSURANCE,
      status: FinancialProductStatus.ACTIVE,
      company: "Manuvie",
      productName: "Protection familiale 500 000 $",
      policyNumber: "MV-48291-QC",
      issuedAt: new Date("2022-06-14"),
      effectiveDate: new Date("2022-06-14"),
      renewalAt: new Date("2026-06-14"),
      nextReviewAt: new Date("2026-05-14"),
      premium: 84,
      premiumFrequency: "MONTHLY",
      coverageAmount: 500000,
      commissionAmount: 1240,
      commissionType: "RENEWAL",
      primaryBeneficiary: "Conjoint",
      contingentBeneficiary: "Enfants",
      documentStatus: "VALIDATED",
    },
  })

  await prisma.document.createMany({
    data: [
      {
        organizationId: organization.id,
        clientId: sophie.id,
        name: "Formulaire profil client - Sophie Tremblay",
        type: "KYC_FORM",
        status: "VALIDATED",
      },
      {
        organizationId: organization.id,
        clientId: karim.id,
        name: "Consentement - Karim Haddad",
        type: "CONSENT_FORM",
        status: "RECEIVED",
      },
    ],
  })

  await prisma.callLog.create({
    data: {
      organizationId: organization.id,
      leadId: antoine.id,
      direction: "INBOUND",
      phoneNumber: antoine.phone,
      status: "MISSED",
      notes: "Appel manque, demande assurance vie.",
    },
  })

  await prisma.sMSMessage.create({
    data: {
      organizationId: organization.id,
      leadId: antoine.id,
      direction: "OUTBOUND",
      phoneNumber: antoine.phone,
      body: "Bonjour Antoine, merci pour votre appel. Je vous reviens rapidement.",
      status: "SENT",
    },
  })

  await prisma.activity.createMany({
    data: [
      {
        organizationId: organization.id,
        leadId: antoine.id,
        type: ActivityType.LEAD_CREATED,
        title: "Prospect cree",
        description: "Antoine Leduc ajoute depuis un appel entrant.",
      },
      {
        organizationId: organization.id,
        clientId: sophie.id,
        userId: demoUser.id,
        type: ActivityType.DOCUMENT_ADDED,
        title: "Document recu",
        description: "Formulaire profil client recu pour Sophie Tremblay.",
      },
    ],
  })

  await prisma.note.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: demoUser.id,
        leadId: antoine.id,
        title: "Besoin principal",
        content: "Antoine veut proteger sa famille avant de finaliser son renouvellement hypothecaire.",
        isPinned: true,
      },
      {
        organizationId: organization.id,
        userId: demoUser.id,
        clientId: sophie.id,
        title: "Revision annuelle",
        content: "Prevoir une analyse des beneficiaires et du montant de couverture en juin.",
      },
    ],
  })

  await prisma.notification.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: demoUser.id,
        type: "WARNING",
        title: "Suivi prioritaire",
        message: "Antoine Leduc doit etre rappele aujourd'hui.",
        href: `/prospects/${antoine.id}`,
      },
      {
        organizationId: organization.id,
        userId: demoUser.id,
        type: "INFO",
        title: "Document recu",
        message: "Formulaire profil client recu pour Sophie Tremblay.",
        href: `/clients/${sophie.id}`,
      },
    ],
  })

  await prisma.automationRule.createMany({
    data: [
      {
        organizationId: organization.id,
        name: "Appel entrant inconnu",
        description: "Cree un prospect, ajoute une activite, envoie un SMS et cree une tache.",
        trigger: "LEAD_CREATED",
        actions: [
          {
            type: "CREATE_TASK",
            title: "Rappeler le nouveau prospect",
            message: "Suivi automatique apres creation du prospect.",
            priority: "HIGH",
            dueInDays: 1,
          },
          {
            type: "NOTIFY_USER",
            title: "Nouveau prospect a traiter",
            message: "Un prospect vient d'etre cree dans le pipeline.",
            priority: "HIGH",
          },
          {
            type: "RUN_WORKFLOW",
            params: { workflowKey: "lead.created.follow_up" },
          },
        ],
        isActive: true,
        runCount: 34,
        lastRunAt: new Date("2026-05-02T09:12:00-04:00"),
      },
      {
        organizationId: organization.id,
        name: "Client sans suivi 90 jours",
        description: "Cree un rappel de suivi pour les dossiers sans activite recente.",
        trigger: "TASK_COMPLETED",
        actions: [
          {
            type: "NOTIFY_USER",
            title: "Suivi termine",
            message: "Une tache vient d'etre completee.",
            priority: "NORMAL",
          },
          {
            type: "RUN_WORKFLOW",
            params: { workflowKey: "task.completed.activity" },
          },
        ],
        isActive: false,
      },
    ],
  })

  console.log("Seed complete for FinAdvisor CRM demo organization.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
