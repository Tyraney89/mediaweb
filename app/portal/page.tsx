"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalendarCheck, LogOut } from "lucide-react"

interface Project {
  id: string
  title: string
  description?: string
  status: string
  createdAt: string
  timeline?: { step: string; status: string }[]
}

export default function PortalPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    async function fetchProjects() {
      const q = query(
        collection(db, "projects"),
        where("clientId", "==", user!.uid),
        orderBy("createdAt", "desc"),
      )
      const snap = await getDocs(q)
      setProjects(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project),
      )
      setLoading(false)
    }
    fetchProjects()
  }, [user, authLoading, router])

  function currentStep(timeline?: { step: string; status: string }[]) {
    if (!timeline) return null
    const active = timeline.find((t) => t.status === "in_progress")
    return active?.step ?? timeline.at(-1)?.step
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-semibold">My Projects</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut().then(() => router.push("/"))}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <CalendarCheck className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">
              You&apos;re all set!
            </h2>
            <p className="max-w-sm text-center text-muted-foreground">
              Your meeting is booked &mdash; that&apos;s all for now.
              We&apos;ll have everything ready for you after your call.
            </p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/portal/${project.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {project.title}
                      </CardTitle>
                      <Badge
                        variant={
                          project.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {project.status}
                      </Badge>
                    </div>
                    {project.description && (
                      <CardDescription>{project.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {currentStep(project.timeline) && (
                      <p className="text-sm text-muted-foreground">
                        Current step:{" "}
                        <span className="font-medium text-foreground">
                          {currentStep(project.timeline)}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
