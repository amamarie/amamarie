import type { Client, Document, Lead, Task, User } from "@prisma/client"

export function canEditClient(user: Pick<User, "id" | "role">, client: Pick<Client, "advisorId">) {
  if (user.role === "OWNER") return true
  if (user.role === "COMPLIANCE") return true
  if (user.role === "ADVISOR") return client.advisorId === user.id
  return false
}

export function canViewClient(user: Pick<User, "id" | "role">, client: Pick<Client, "advisorId">) {
  if (user.role === "OWNER") return true
  if (user.role === "COMPLIANCE") return true
  if (user.role === "ADVISOR") return client.advisorId === user.id
  return false
}

export function canEditLead(user: Pick<User, "id" | "role">, lead: Pick<Lead, "advisorId">) {
  if (user.role === "OWNER") return true
  if (user.role === "ADVISOR") return lead.advisorId === user.id
  return false
}

export function canViewLead(user: Pick<User, "id" | "role">, lead: Pick<Lead, "advisorId">) {
  if (user.role === "OWNER") return true
  if (user.role === "COMPLIANCE") return true
  if (user.role === "ADVISOR") return lead.advisorId === user.id
  if (user.role === "ASSISTANT") return true
  return false
}

export function canEditTask(user: Pick<User, "id" | "role">, task: Pick<Task, "assignedToId" | "createdById">) {
  if (user.role === "OWNER") return true
  if (user.role === "ADVISOR") return task.assignedToId === user.id || task.createdById === user.id
  if (user.role === "ASSISTANT") return task.assignedToId === user.id
  return false
}

export function canViewDocument(user: Pick<User, "id" | "role">, document: Pick<Document, "uploadedById"> & { client?: Pick<Client, "advisorId"> | null; lead?: Pick<Lead, "advisorId"> | null }) {
  if (user.role === "OWNER") return true
  if (user.role === "COMPLIANCE") return true
  if (document.uploadedById === user.id) return true
  if (user.role === "ADVISOR") return document.client?.advisorId === user.id || document.lead?.advisorId === user.id
  return false
}
