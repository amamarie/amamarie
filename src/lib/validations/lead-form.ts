import { z } from "zod"

const slugSchema = z.string()
  .trim()
  .min(3, "Le slug doit contenir au moins 3 caractères.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilisez seulement des lettres minuscules, chiffres et tirets.")

export const leadFormFieldSchema = z.object({
  name: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(80)).optional(),
})

export const defaultLeadFormFields = [
  { name: "firstName", label: "Prénom", type: "text", required: true },
  { name: "lastName", label: "Nom", type: "text", required: true },
  { name: "email", label: "Courriel", type: "email", required: true },
  { name: "phone", label: "Téléphone", type: "tel", required: true },
  { name: "interestType", label: "Type d’assurance recherché", type: "select", required: true, options: ["Assurance vie", "Assurance invalidité", "Assurance maladies graves", "Assurance collective", "Placements", "Autre"] },
  { name: "message", label: "Message", type: "textarea", required: false },
  { name: "consent", label: "J’accepte d’être contacté par ce conseiller.", type: "checkbox", required: true },
] satisfies z.infer<typeof leadFormFieldSchema>[]

export const createLeadFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  subdomainSlug: slugSchema.optional().or(z.literal("")),
  publicTitle: z.string().trim().min(2).max(160),
  publicDescription: z.string().trim().max(500).optional().or(z.literal("")),
  successMessage: z.string().trim().max(300).optional().or(z.literal("")),
  googleSheetId: z.string().trim().max(160).optional().or(z.literal("")),
  googleSheetName: z.string().trim().max(80).optional().or(z.literal("")),
  fields: z.array(leadFormFieldSchema).min(1).default(defaultLeadFormFields),
})

export const updateLeadFormSchema = createLeadFormSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const submitLeadFormSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis.").max(80),
  lastName: z.string().trim().min(1, "Le nom est requis.").max(80),
  email: z.string().trim().email("Courriel invalide.").max(160),
  phone: z.string().trim().min(8, "Le téléphone est requis.").max(32),
  interestType: z.string().trim().min(1, "Le type d’assurance est requis.").max(120),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  consent: z.literal(true, { message: "Le consentement est requis." }),
}).passthrough()

export type CreateLeadFormInput = z.infer<typeof createLeadFormSchema>
export type SubmitLeadFormInput = z.infer<typeof submitLeadFormSchema>
export type LeadFormField = z.infer<typeof leadFormFieldSchema>
