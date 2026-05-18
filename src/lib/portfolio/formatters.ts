import {
  financialProductTypeLabels,
  paymentFrequencyLabels,
} from "@/lib/financial-products"

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatPercentage(value?: number | null) {
  return new Intl.NumberFormat("fr-CA", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format((value ?? 0) / 100)
}

export function formatFrequency(value?: string | null) {
  if (!value) return "Non définie"
  return paymentFrequencyLabels[value] ?? value
}

export function formatProductType(value?: string | null) {
  if (!value) return "Non défini"
  return financialProductTypeLabels[value] ?? value
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "Non définie"
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}
