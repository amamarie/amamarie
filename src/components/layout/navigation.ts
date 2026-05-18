import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckSquare,
  FileText,
  FileInput,
  FileSpreadsheet,
  Gauge,
  History,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessagesSquare,
  PhoneCall,
  KanbanSquare,
  PackageCheck,
  PieChart,
  SlidersHorizontal,
  Settings,
  ShieldCheck,
  Target,
  ListChecks,
  UserRound,
  UsersRound,
  Bell,
  BellRing,
  Database,
  Headset,
  Home,
  ReceiptText,
} from "lucide-react"

import type { ModuleKey } from "@/lib/billing/plans"

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
  moduleKey: ModuleKey
  badge?: string
  message: string
}

export const navigationItems: NavigationItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
    moduleKey: "dashboard",
    message: "Priorités, pipeline et actions du jour.",
  },
  {
    label: "Prospects",
    href: "/prospects",
    icon: UserRound,
    moduleKey: "prospects",
    message: "Nouveaux contacts et relances à qualifier.",
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: KanbanSquare,
    moduleKey: "pipeline",
    message: "Vue Kanban des prospects et suivis commerciaux.",
  },
  {
    label: "Clients",
    href: "/clients",
    icon: UsersRound,
    moduleKey: "clients",
    message: "Portefeuille client et suivis actifs.",
  },
  {
    label: "Foyers",
    href: "/foyers",
    icon: Home,
    moduleKey: "clients",
    message: "Familles, conjoints, personnes à charge et vision patrimoniale.",
  },
  {
    label: "Entreprises",
    href: "/entreprises",
    icon: Building2,
    moduleKey: "clients",
    message: "Clients professionnels, profils KYB et risques entreprise.",
  },
  {
    label: "Contrats",
    href: "/contrats",
    icon: PackageCheck,
    moduleKey: "clients",
    message: "Contrats, produits, échéances, compagnies et statuts.",
  },
  {
    label: "Échéances",
    href: "/echeances",
    icon: CalendarClock,
    moduleKey: "clients",
    message: "Renouvellements, revues, documents expirants et bilans.",
  },
  {
    label: "Portefeuille",
    href: "/portefeuille",
    icon: PieChart,
    moduleKey: "clients",
    message: "Répartition des encours, protections et équipements clients.",
  },
  {
    label: "Historique conseil",
    href: "/historique-conseil",
    icon: History,
    moduleKey: "clients",
    message: "Notes, recommandations, documents et traçabilité client.",
  },
  {
    label: "Objectifs & besoins",
    href: "/objectifs-besoins",
    icon: Target,
    moduleKey: "client-profile",
    message: "Objectifs, besoins, profils risque et analyses à traiter.",
  },
  {
    label: "Scores CRM",
    href: "/scores-crm",
    icon: Gauge,
    moduleKey: "clients",
    message: "Scores relation, dossier, opportunité et prospects chauds.",
  },
  {
    label: "Tâches",
    href: "/taches",
    icon: CheckSquare,
    moduleKey: "tasks",
    message: "Actions prioritaires et échéances.",
  },
  {
    label: "Priorités",
    href: "/priorities",
    icon: ListChecks,
    moduleKey: "priorities",
    message: "Liste quotidienne des dossiers à traiter en premier.",
  },
  {
    label: "Rappels intelligents",
    href: "/rappels-intelligents",
    icon: BellRing,
    moduleKey: "smart-reminders",
    message: "Échéances, KYC, AML, consentements et actions proactives.",
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    moduleKey: "notifications",
    message: "Événements importants et suivis à consulter.",
  },
  {
    label: "Communications",
    href: "/communications",
    icon: PhoneCall,
    moduleKey: "communications",
    message: "Appels entrants, appels manqués et SMS Twilio.",
  },
  {
    label: "Marketing CRM",
    href: "/marketing",
    icon: Megaphone,
    moduleKey: "marketing",
    message: "Consentements, campagnes et interactions marketing.",
  },
  {
    label: "Téléphonie",
    href: "/settings/communications",
    icon: Settings,
    moduleKey: "telephony",
    message: "Numéro Twilio, boîte vocale, alertes SMS et transcription.",
  },
  {
    label: "Formulaires",
    href: "/formulaires",
    icon: FileInput,
    moduleKey: "lead-forms",
    message: "Liens publics, soumissions et création automatique de prospects.",
  },
  {
    label: "Calendrier",
    href: "/calendrier",
    icon: CalendarDays,
    moduleKey: "calendar",
    message: "Rendez-vous, appels et rappels.",
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileText,
    moduleKey: "documents",
    message: "Pièces reçues, demandes et signatures.",
  },
  {
    label: "Commissions",
    href: "/commissions",
    icon: ReceiptText,
    moduleKey: "clients",
    message: "Commissions estimées par contrat, client, conseiller et compagnie.",
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: FileSpreadsheet,
    moduleKey: "clients",
    message: "Importer des clients et contrats, exporter le portefeuille.",
  },
  {
    label: "Qualité données",
    href: "/qualite-donnees",
    icon: Database,
    moduleKey: "clients",
    message: "Doublons, coordonnées, assignations et contrats à nettoyer.",
  },
  {
    label: "Conformité",
    href: "/compliance",
    icon: ShieldCheck,
    moduleKey: "compliance",
    message: "Profils client, consentements et alertes réglementaires.",
  },
  {
    label: "Profil client",
    href: "/profil-client",
    icon: UserRound,
    moduleKey: "client-profile",
    message: "Connaissance client, objectifs, versions figées et règles cabinet.",
  },
  {
    label: "Automatisations",
    href: "/automatisations",
    icon: Bot,
    moduleKey: "automations",
    message: "Séquences et suivis automatisés.",
  },
  {
    label: "Recommandations",
    href: "/recommendations",
    icon: Lightbulb,
    moduleKey: "recommendations",
    message: "Pistes de suivi et dossiers à valider.",
  },
  {
    label: "Opportunités",
    href: "/cross-sell",
    icon: MessagesSquare,
    moduleKey: "opportunities",
    message: "Sujets commerciaux à discuter prudemment.",
  },
  {
    label: "Rapports",
    href: "/rapports",
    icon: BarChart3,
    moduleKey: "reports",
    message: "Performance et activité commerciale.",
  },
  {
    label: "Pilotage CRM",
    href: "/pilotage-crm",
    icon: SlidersHorizontal,
    moduleKey: "reports",
    message: "Vue manager des clients, prospects, dossiers et conversions.",
  },
  {
    label: "Paramètres",
    href: "/parametres",
    icon: Settings,
    moduleKey: "settings",
    message: "Gérez votre espace, votre équipe, vos modèles et votre sécurité.",
  },
  {
    label: "Support",
    href: "/support",
    icon: Headset,
    moduleKey: "settings",
    message: "Créez et suivez les tickets support du cabinet.",
  },
]

export function getActiveNavigationItem(pathname: string) {
  return (
    navigationItems.find((item) => {
      if (item.href === "/dashboard") {
        return pathname === item.href
      }

      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    }) ?? navigationItems[0]
  )
}
