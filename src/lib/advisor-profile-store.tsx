"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

export type AdvisorProfile = {
  id: string
  firstName: string
  lastName: string
  displayName: string
  title: string
  phone: string
  email: string
  avatarUrl: string
  language: string
  specialties: string
  zones: string
  licenseNumber: string
  signatureEmail: string
  signatureSms: string
  updatedAt: string
}

type AdvisorProfileContextValue = {
  advisorProfile: AdvisorProfile
  setAdvisorProfile: (profile: AdvisorProfile) => void
  updateAdvisorProfile: (profile: Partial<AdvisorProfile>) => AdvisorProfile
  updateAdvisorSignature: (signature: Pick<Partial<AdvisorProfile>, "signatureEmail" | "signatureSms">) => AdvisorProfile
}

export const advisorProfileStorageKey = "finadvisor.advisorProfile"
const legacyAdvisorProfileStorageKey = "finadvisor.settings.advisorProfile"
const legacyAdvisorSignatureStorageKey = "finadvisor.settings.advisorSignature"

function advisorScopedStorageKey(profileId?: string) {
  return profileId ? `${advisorProfileStorageKey}.${profileId}` : advisorProfileStorageKey
}

export const defaultAdvisorProfile: AdvisorProfile = normalizeAdvisorProfile({
  id: "current-advisor",
  firstName: "Conseiller",
  lastName: "",
  title: "Espace sécurisé",
  phone: "",
  email: "",
  avatarUrl: "",
  language: "Français",
  specialties: "",
  zones: "",
  licenseNumber: "",
  updatedAt: "",
})

const AdvisorProfileContext = createContext<AdvisorProfileContextValue | null>(null)

export function AdvisorProfileProvider({ children, initialProfile }: { children: React.ReactNode; initialProfile?: Partial<AdvisorProfile> }) {
  const [advisorProfile, setAdvisorProfileState] = useState<AdvisorProfile>(() =>
    initialProfile ? normalizeAdvisorProfile(initialProfile) : defaultAdvisorProfile
  )

  useEffect(() => {
    let cancelled = false
    window.setTimeout(() => {
      if (!cancelled) {
        const storedProfile = readStoredAdvisorProfile(initialProfile?.id)
        const hasStoredIdentity =
          storedProfile.displayName !== defaultAdvisorProfile.displayName ||
          Boolean(storedProfile.email || storedProfile.phone)
        setAdvisorProfileState(hasStoredIdentity
          ? normalizeAdvisorProfile({
              ...(initialProfile ?? defaultAdvisorProfile),
              ...storedProfile,
              specialties: storedProfile.specialties || initialProfile?.specialties || "",
            })
          : normalizeAdvisorProfile(initialProfile ?? defaultAdvisorProfile))
      }
    }, 0)
    return () => {
      cancelled = true
    }
  }, [initialProfile])

  const value = useMemo<AdvisorProfileContextValue>(() => {
    function setAdvisorProfile(nextProfile: AdvisorProfile) {
      const normalizedProfile = normalizeAdvisorProfile(nextProfile)
      setAdvisorProfileState(normalizedProfile)
      persistAdvisorProfile(normalizedProfile)
      return normalizedProfile
    }

    function updateAdvisorProfile(partialProfile: Partial<AdvisorProfile>) {
      const nextProfile = normalizeAdvisorProfile({
        ...advisorProfile,
        ...partialProfile,
        updatedAt: new Date().toISOString(),
      }, { regenerateSignature: true })
      setAdvisorProfileState(nextProfile)
      persistAdvisorProfile(nextProfile)
      syncAdvisorProfile(nextProfile)
      return nextProfile
    }

    function updateAdvisorSignature(partialSignature: Pick<Partial<AdvisorProfile>, "signatureEmail" | "signatureSms">) {
      const nextProfile = normalizeAdvisorProfile({
        ...advisorProfile,
        ...partialSignature,
        updatedAt: new Date().toISOString(),
      }, { regenerateSignature: false })
      setAdvisorProfileState(nextProfile)
      persistAdvisorProfile(nextProfile)
      return nextProfile
    }

    return {
      advisorProfile,
      setAdvisorProfile,
      updateAdvisorProfile,
      updateAdvisorSignature,
    }
  }, [advisorProfile])

  return <AdvisorProfileContext.Provider value={value}>{children}</AdvisorProfileContext.Provider>
}

export function useAdvisorProfile() {
  const context = useContext(AdvisorProfileContext)
  if (!context) {
    return {
      advisorProfile: defaultAdvisorProfile,
      setAdvisorProfile: () => defaultAdvisorProfile,
      updateAdvisorProfile: () => defaultAdvisorProfile,
      updateAdvisorSignature: () => defaultAdvisorProfile,
    }
  }

  return context
}

export function getAdvisorInitials(profile: AdvisorProfile) {
  const source = profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || "Conseiller"
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C"
}

export function buildAdvisorEmailSignature(profile: Partial<AdvisorProfile>) {
  const displayName = getAdvisorDisplayName(profile)
  const title = profile.title?.trim() || "Espace sécurisé"
  const contactParts = [profile.phone, profile.email, "Site web"].filter(Boolean)

  return [
    displayName,
    title,
    "FinAdvisor CRM",
    contactParts.join(" · "),
  ].filter(Boolean).join("\n")
}

export function buildAdvisorSmsSignature(profile: Partial<AdvisorProfile>) {
  const displayName = getAdvisorDisplayName(profile)
  const title = profile.title?.trim()
  return title ? `${displayName}, ${title.toLowerCase()}` : displayName
}

export function getAdvisorDisplayName(profile: Partial<AdvisorProfile>) {
  return `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || profile.displayName?.trim() || "Conseiller"
}

function normalizeAdvisorProfile(profile: Partial<AdvisorProfile>, options: { regenerateSignature?: boolean } = {}): AdvisorProfile {
  const displayName = getAdvisorDisplayName(profile)
  const normalizedProfile = {
    id: profile.id?.trim() || "current-advisor",
    firstName: profile.firstName?.trim() || "Conseiller",
    lastName: profile.lastName?.trim() || "",
    displayName,
    title: profile.title?.trim() || "Espace sécurisé",
    phone: profile.phone?.trim() || "",
    email: profile.email?.trim() || "",
    avatarUrl: profile.avatarUrl?.trim() || "",
    language: profile.language?.trim() || "Français",
    specialties: profile.specialties?.trim() || "",
    zones: (profile.zones ?? (profile as { serviceAreas?: string }).serviceAreas)?.trim() || "",
    licenseNumber: profile.licenseNumber?.trim() || "",
    signatureEmail: profile.signatureEmail?.trim() || "",
    signatureSms: profile.signatureSms?.trim() || "",
    updatedAt: profile.updatedAt?.trim() || new Date().toISOString(),
  }

  const signatureBelongsToAnotherAdvisor = Boolean(
    displayName !== "Conseiller" &&
    normalizedProfile.signatureEmail &&
    !normalizedProfile.signatureEmail.includes(displayName)
  )

  return {
    ...normalizedProfile,
    displayName,
    signatureEmail: options.regenerateSignature || !normalizedProfile.signatureEmail || signatureBelongsToAnotherAdvisor
      ? buildAdvisorEmailSignature(normalizedProfile)
      : normalizedProfile.signatureEmail,
    signatureSms: options.regenerateSignature || !normalizedProfile.signatureSms || signatureBelongsToAnotherAdvisor
      ? buildAdvisorSmsSignature(normalizedProfile)
      : normalizedProfile.signatureSms,
  }
}

function readStoredAdvisorProfile(profileId?: string) {
  if (typeof window === "undefined") return defaultAdvisorProfile

  try {
    const storedProfile = window.localStorage.getItem(advisorScopedStorageKey(profileId))
    if (storedProfile) return normalizeAdvisorProfile(JSON.parse(storedProfile))

    if (profileId) return defaultAdvisorProfile

    const legacyProfile = window.localStorage.getItem(legacyAdvisorProfileStorageKey)
    const legacySignature = window.localStorage.getItem(legacyAdvisorSignatureStorageKey)
    if (legacyProfile || legacySignature) {
      const profile = legacyProfile ? JSON.parse(legacyProfile) : {}
      const signature = legacySignature ? JSON.parse(legacySignature) : {}
      const migrated = normalizeAdvisorProfile({
        ...profile,
        zones: profile.zones ?? profile.serviceAreas,
        signatureEmail: signature.emailSignature,
        signatureSms: signature.smsSignature,
      }, { regenerateSignature: !signature.emailSignature && !signature.smsSignature })
      persistAdvisorProfile(migrated)
      return migrated
    }
  } catch {
    return defaultAdvisorProfile
  }

  return defaultAdvisorProfile
}

function persistAdvisorProfile(profile: AdvisorProfile) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(advisorScopedStorageKey(profile.id), JSON.stringify(profile))
  window.localStorage.setItem(legacyAdvisorProfileStorageKey, JSON.stringify({
    firstName: profile.firstName,
    lastName: profile.lastName,
    title: profile.title,
    phone: profile.phone,
    email: profile.email,
    language: profile.language,
    specialties: profile.specialties,
    serviceAreas: profile.zones,
    licenseNumber: profile.licenseNumber,
  }))
  window.localStorage.setItem(legacyAdvisorSignatureStorageKey, JSON.stringify({
    emailSignature: profile.signatureEmail,
    smsSignature: profile.signatureSms,
  }))
}

function syncAdvisorProfile(profile: AdvisorProfile) {
  if (typeof window === "undefined") return

  window
    .fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        title: profile.title,
        phone: profile.phone,
        email: profile.email,
        specialties: profile.specialties,
        zones: profile.zones,
        language: profile.language,
        licenseNumber: profile.licenseNumber,
      }),
    })
    .catch(() => undefined)
}
