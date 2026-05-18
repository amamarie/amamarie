import type { Prisma, UserRole } from "@prisma/client"
import type { z } from "zod"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import type { createDocumentFolderSchema, documentFolderQuerySchema, updateDocumentFolderSchema } from "@/lib/validations/document"

type CurrentUser = { id: string; organizationId: string; role?: UserRole }
type CreateFolderInput = z.infer<typeof createDocumentFolderSchema>
type UpdateFolderInput = z.infer<typeof updateDocumentFolderSchema>
type FolderQueryInput = z.infer<typeof documentFolderQuerySchema>

const CLIENT_FOLDER_TEMPLATE = ["Devis", "Contrats", "Factures", "Documents signés", "Communications", "Pièces jointes", "Autres documents"]
const ROOT_FOLDERS = ["Clients", "Fournisseurs", "Employés", "Factures", "Contrats", "Ressources humaines", "Comptabilité", "Projets", "Documents internes", "Documents à signer", "À classer"]

function slugSegment(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120)
}

async function assertFolderOwnership(organizationId: string, folderId?: string | null) {
  if (!folderId) return null
  return prisma.documentFolder.findFirstOrThrow({ where: { id: folderId, organizationId }, select: { id: true, path: true, depth: true, clientId: true, leadId: true } })
}

async function assertRelatedOwnership(organizationId: string, data: Partial<CreateFolderInput>) {
  const checks: Promise<unknown>[] = []
  if (data.clientId) checks.push(prisma.client.findFirstOrThrow({ where: { id: data.clientId, organizationId }, select: { id: true } }))
  if (data.leadId) checks.push(prisma.lead.findFirstOrThrow({ where: { id: data.leadId, organizationId }, select: { id: true } }))
  await Promise.all(checks)
}

async function buildPath(organizationId: string, name: string, parentId?: string | null) {
  const parent = await assertFolderOwnership(organizationId, parentId)
  const segment = slugSegment(name)
  return {
    parent,
    path: parent ? `${parent.path}/${segment}` : segment,
    depth: parent ? parent.depth + 1 : 0,
  }
}

async function refreshDescendantPaths(organizationId: string, parentId: string, parentPath: string, parentDepth: number) {
  const children = await prisma.documentFolder.findMany({ where: { organizationId, parentId } })
  for (const child of children) {
    const path = `${parentPath}/${child.name}`
    const depth = parentDepth + 1
    await prisma.documentFolder.updateMany({
      where: { id: child.id, organizationId },
      data: { path, depth },
    })
    await refreshDescendantPaths(organizationId, child.id, path, depth)
  }
}

export async function ensureDefaultDocumentFolders(organizationId: string) {
  const created = []
  for (const name of ROOT_FOLDERS) {
    const folder = await prisma.documentFolder.upsert({
      where: { id: `${organizationId}:${name}` },
      update: {},
      create: {
        id: `${organizationId}:${name}`,
        organizationId,
        name,
        path: name,
        type: "ROOT",
        isSystem: true,
      },
    }).catch(async () => {
      const existing = await prisma.documentFolder.findFirst({ where: { organizationId, parentId: null, name } })
      if (existing) return existing
      return prisma.documentFolder.create({ data: { organizationId, name, path: name, type: "ROOT", isSystem: true } })
    })
    created.push(folder)
  }
  return created
}

export async function getUnclassifiedFolder(organizationId: string) {
  await ensureDefaultDocumentFolders(organizationId)
  return prisma.documentFolder.findFirstOrThrow({ where: { organizationId, parentId: null, name: "À classer" } })
}

export async function createDocumentFolder({ user, data }: { user: CurrentUser; data: CreateFolderInput }) {
  await assertRelatedOwnership(user.organizationId, data)
  const { parent, path, depth } = await buildPath(user.organizationId, data.name, data.parentId)
  const folder = await prisma.documentFolder.create({
    data: {
      organizationId: user.organizationId,
      name: data.name,
      description: data.description,
      type: data.type,
      parentId: data.parentId,
      clientId: data.clientId ?? parent?.clientId,
      leadId: data.leadId ?? parent?.leadId,
      path,
      depth,
    },
  })
  await createCrmActivity({ organizationId: user.organizationId, userId: user.id, clientId: folder.clientId, leadId: folder.leadId, type: "DOCUMENT_ADDED", title: "Dossier créé", description: folder.path, entityType: "DocumentFolder", entityId: folder.id })
  return folder
}

export async function getDocumentFolders({ user, query }: { user: CurrentUser; query: FolderQueryInput }) {
  await ensureDefaultDocumentFolders(user.organizationId)
  const where: Prisma.DocumentFolderWhereInput = {
    organizationId: user.organizationId,
    ...(query.includeArchived ? {} : { status: "ACTIVE" }),
    ...(query.parentId ? { parentId: query.parentId } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.search ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { path: { contains: query.search, mode: "insensitive" } }] } : {}),
  }
  const folders = await prisma.documentFolder.findMany({
    where,
    include: {
      _count: { select: { documents: true, children: true } },
      parent: { select: { id: true, name: true, path: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ depth: "asc" }, { name: "asc" }],
  })
  return folders
}

export async function updateDocumentFolder({ user, id, data }: { user: CurrentUser; id: string; data: UpdateFolderInput }) {
  const existing = await prisma.documentFolder.findFirst({ where: { id, organizationId: user.organizationId } })
  if (!existing) throw new Error("FOLDER_NOT_FOUND")
  await assertRelatedOwnership(user.organizationId, data)
  const nextParentId = data.parentId === undefined ? existing.parentId : data.parentId
  if (nextParentId === id) throw new Error("FOLDER_INVALID_PARENT")
  const nextName = data.name ?? existing.name
  const { parent, path, depth } = await buildPath(user.organizationId, nextName, nextParentId)
  if (parent && (parent.id === id || parent.path === existing.path || parent.path.startsWith(`${existing.path}/`))) {
    throw new Error("FOLDER_INVALID_PARENT")
  }
  await prisma.documentFolder.updateMany({
    where: { id, organizationId: user.organizationId },
    data: {
      ...data,
      parentId: nextParentId,
      name: nextName,
      clientId: data.clientId ?? parent?.clientId ?? existing.clientId,
      leadId: data.leadId ?? parent?.leadId ?? existing.leadId,
      path,
      depth,
      archivedAt: data.status === "ARCHIVED" ? new Date() : data.status === "ACTIVE" ? null : existing.archivedAt,
    },
  })
  const folder = await prisma.documentFolder.findFirstOrThrow({ where: { id, organizationId: user.organizationId } })
  await refreshDescendantPaths(user.organizationId, folder.id, folder.path, folder.depth)
  await createCrmActivity({ organizationId: user.organizationId, userId: user.id, clientId: folder.clientId, leadId: folder.leadId, type: "DOCUMENT_UPDATED", title: "Dossier modifié", description: folder.path, entityType: "DocumentFolder", entityId: folder.id })
  return folder
}

export async function archiveDocumentFolder({ user, id }: { user: CurrentUser; id: string }) {
  return updateDocumentFolder({ user, id, data: { status: "ARCHIVED" } })
}

export async function moveDocumentToFolder({ user, documentId, folderId }: { user: CurrentUser; documentId: string; folderId?: string | null }) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId: user.organizationId } })
  if (!document) throw new Error("DOCUMENT_NOT_FOUND")
  const folder = folderId ? await assertFolderOwnership(user.organizationId, folderId) : await getUnclassifiedFolder(user.organizationId)
  await prisma.document.updateMany({ where: { id: documentId, organizationId: user.organizationId }, data: { folderId: folder?.id ?? null } })
  const updated = await prisma.document.findFirstOrThrow({ where: { id: documentId, organizationId: user.organizationId }, include: { folder: true, client: true, lead: true } })
  await createCrmActivity({ organizationId: user.organizationId, userId: user.id, clientId: updated.clientId, leadId: updated.leadId, documentId: updated.id, type: "DOCUMENT_UPDATED", title: "Document déplacé", description: updated.folder?.path ?? "À classer", entityType: "Document", entityId: updated.id })
  return updated
}

export async function ensureClientFolderStructure({ organizationId, clientId, userId }: { organizationId: string; clientId: string; userId?: string | null }) {
  await ensureDefaultDocumentFolders(organizationId)
  const client = await prisma.client.findFirstOrThrow({ where: { id: clientId, organizationId }, select: { id: true, firstName: true, lastName: true } })
  const clientsRoot = await prisma.documentFolder.findFirstOrThrow({ where: { organizationId, parentId: null, name: "Clients" } })
  const clientName = `${client.firstName} ${client.lastName}`.trim()
  let createdStructure = false
  let clientFolder = await prisma.documentFolder.findFirst({ where: { organizationId, parentId: clientsRoot.id, clientId } })
  if (!clientFolder) {
    clientFolder = await prisma.documentFolder.create({
      data: { organizationId, parentId: clientsRoot.id, clientId, name: clientName, path: `${clientsRoot.path}/${clientName}`, depth: clientsRoot.depth + 1, type: "CLIENT", isSystem: true },
    })
    createdStructure = true
  }
  for (const name of CLIENT_FOLDER_TEMPLATE) {
    const existing = await prisma.documentFolder.findFirst({ where: { organizationId, parentId: clientFolder.id, name } })
    if (!existing) {
      await prisma.documentFolder.create({ data: { organizationId, parentId: clientFolder.id, clientId, name, path: `${clientFolder.path}/${name}`, depth: clientFolder.depth + 1, type: "CLIENT_SECTION", isSystem: true } })
      createdStructure = true
    }
  }
  if (userId && createdStructure) {
    await createCrmActivity({ organizationId, userId, clientId, type: "DOCUMENT_ADDED", title: "Structure de dossiers client créée", description: clientFolder.path, entityType: "DocumentFolder", entityId: clientFolder.id })
  }
  return clientFolder
}
