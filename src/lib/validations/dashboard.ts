import { z } from "zod"

export const dashboardSummaryQuerySchema = z.object({
  advisorId: z.string().trim().min(1).optional(),
  scope: z.enum(["my", "organization"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>
