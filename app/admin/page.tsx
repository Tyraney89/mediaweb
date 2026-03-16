"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Plus, Users, FolderOpen } from "lucide-react"

interface UserDoc {
  id: string
  email: string
  displayName: string
  createdAt: string
}

interface ProjectDoc {
  id: string
  title: string
  description?: string
  status: string
  clientId: string
  clientEmail?: string
  amountCents?: number
  amountPaid?: number
  createdAt: string
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminDashboardPage() {
  const [waitingClients, setWaitingClients] = useState<UserDoc[]>([])
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [usersSnap, projectsSnap] = await Promise.all([
        getDocs(
          query(collection(db, "users"), orderBy("createdAt", "desc")),
        ),
        getDocs(
          query(collection(db, "projects"), orderBy("createdAt", "desc")),
        ),
      ])

      const allUsers = usersSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as UserDoc,
      )
      const allProjects = projectsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ProjectDoc,
      )

      const userMap = new Map(allUsers.map((u) => [u.id, u]))
      const clientIdsWithProjects = new Set(
        allProjects.map((p) => p.clientId),
      )

      setWaitingClients(
        allUsers.filter(
          (u) => !clientIdsWithProjects.has(u.id) && !u.id.startsWith("admin"),
        ),
      )
      setProjects(
        allProjects.map((p) => ({
          ...p,
          clientEmail: userMap.get(p.clientId)?.email,
        })),
      )
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/admin/projects/new">
            <Plus className="size-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Waiting clients */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Waiting for Meeting</h2>
          <Badge variant="secondary">{waitingClients.length}</Badge>
        </div>
        {waitingClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clients waiting — everyone has a project.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waitingClients.map((client) => (
              <Card key={client.id} size="sm">
                <CardHeader>
                  <CardTitle className="text-sm">{client.email}</CardTitle>
                  <CardDescription>
                    {client.displayName || "No name"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Signed up{" "}
                    {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* All projects */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <FolderOpen className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Projects</h2>
          <Badge variant="secondary">{projects.length}</Badge>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet.{" "}
            <Link
              href="/admin/projects/new"
              className="text-primary underline underline-offset-4"
            >
              Create one
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
              >
                <Card
                  size="sm"
                  className="transition-colors hover:bg-muted/50"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm">
                        {project.title}
                      </CardTitle>
                      <Badge
                        variant={
                          project.status === "completed"
                            ? "default"
                            : project.status === "awaiting_payment"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {formatStatus(project.status)}
                      </Badge>
                    </div>
                    {project.clientEmail && (
                      <CardDescription>
                        {project.clientEmail}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {project.amountPaid
                        ? `Paid $${project.amountPaid}`
                        : project.amountCents
                          ? `$${(project.amountCents / 100).toFixed(2)} pending`
                          : "No amount set"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
