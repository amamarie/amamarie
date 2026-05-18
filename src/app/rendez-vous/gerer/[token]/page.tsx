import { BookingManagementClient } from "./BookingManagementClient"

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <BookingManagementClient token={token} />
}
