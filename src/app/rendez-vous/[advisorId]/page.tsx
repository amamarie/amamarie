import { PublicBookingPage } from "@/components/calendar/public/PublicBookingPage"
import { getPublicCalendarData } from "@/lib/calendar/public-calendar"

export const dynamic = "force-dynamic"

type BookingSearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function BookingPage({ params, searchParams }: { params: Promise<{ advisorId: string }>; searchParams: BookingSearchParams }) {
  const { advisorId } = await params
  const query = await searchParams
  const initialData = await getPublicCalendarData(advisorId)
  return (
    <PublicBookingPage
      advisorId={advisorId}
      initialData={initialData}
      initialDate={firstParam(query.date)}
      initialDuration={firstParam(query.duration)}
      initialMarketingToken={firstParam(query.marketingToken)}
      initialService={firstParam(query.service)}
      initialTime={firstParam(query.time)}
    />
  )
}
