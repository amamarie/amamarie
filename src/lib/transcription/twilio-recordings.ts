function ensureDownloadUrl(recordingUrl: string) {
  if (/\.(mp3|wav|m4a|mp4|webm)$/i.test(recordingUrl)) return recordingUrl
  return `${recordingUrl}.mp3`
}

export async function downloadTwilioRecording({ recordingUrl }: { recordingUrl: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) throw new Error("TWILIO_NOT_CONFIGURED")

  const response = await fetch(ensureDownloadUrl(recordingUrl), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
  })

  if (!response.ok) throw new Error("TWILIO_RECORDING_DOWNLOAD_FAILED")
  const contentType = response.headers.get("content-type") ?? "audio/mpeg"
  const arrayBuffer = await response.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
    fileName: "twilio-recording.mp3",
  }
}
