"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { getStripe } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Check,
  Circle,
  CreditCard,
  Download,
  Loader2,
} from "lucide-react"

interface TimelineStep {
  step: string
  status: "completed" | "in_progress" | "pending"
}

interface ProjectFile {
  id: string
  name: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

interface ProjectData {
  title: string
  description?: string
  status: string
  amountCents?: number
  amountPaid?: number
  createdAt: string
  timeline?: TimelineStep[]
  clientId: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function TimelineIcon({ status }: { status: TimelineStep["status"] }) {
  if (status === "completed") {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-4" />
      </div>
    )
  }
  if (status === "in_progress") {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
        <Loader2 className="size-4 animate-spin text-primary" />
      </div>
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-muted bg-background">
      <Circle className="size-3 text-muted-foreground" />
    </div>
  )
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    async function fetchData() {
      const projectSnap = await getDoc(doc(db, "projects", projectId))
      if (projectSnap.exists()) {
        const data = projectSnap.data() as ProjectData
        if (data.clientId !== user!.uid) {
          router.push("/portal")
          return
        }
        setProject(data)

        const filesSnap = await getDocs(
          collection(db, "projects", projectId, "files"),
        )
        setFiles(
          filesSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as ProjectFile,
          ),
        )
      }
      setLoading(false)
    }
    fetchData()
  }, [user, authLoading, projectId, router])

  async function handleCheckout() {
    setPaying(true)
    setPayError("")
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (data.url) {
        const stripe = await getStripe()
        if (stripe) {
          window.location.href = data.url
        }
      } else {
        setPayError(data.error ?? "Failed to start checkout")
      }
    } catch {
      setPayError("Something went wrong")
    } finally {
      setPaying(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button asChild variant="outline">
          <Link href="/portal">Back to Portal</Link>
        </Button>
      </div>
    )
  }

  const isAwaitingPayment = project.status === "awaiting_payment"
  const completedSteps =
    project.timeline?.filter((t) => t.status === "completed").length ?? 0
  const totalSteps = project.timeline?.length ?? 0

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/portal">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center justify-between">
          <h1 className="text-lg font-semibold">{project.title}</h1>
          <Badge
            variant={
              project.status === "completed" ? "default" : "secondary"
            }
          >
            {formatStatus(project.status)}
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        {project.description && (
          <p className="text-muted-foreground">{project.description}</p>
        )}

        {/* Payment card — shown when awaiting payment */}
        {isAwaitingPayment && project.amountCents && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Payment Required</CardTitle>
                  <CardDescription>
                    Complete payment to get your project started
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-3xl font-bold">
                  ${(project.amountCents / 100).toFixed(2)}
                </span>
              </div>

              {payError && (
                <p className="text-sm text-destructive">{payError}</p>
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={paying}
              >
                {paying ? "Redirecting to Stripe..." : "Pay Now"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {project.timeline && project.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Timeline</CardTitle>
              <CardDescription>
                {completedSteps} of {totalSteps} steps completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-0">
                {project.timeline.map((step, i) => (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <TimelineIcon status={step.status} />
                      {i < project.timeline!.length - 1 && (
                        <div
                          className={`min-h-6 w-0.5 flex-1 ${
                            step.status === "completed"
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`font-medium ${
                          step.status === "pending"
                            ? "text-muted-foreground"
                            : ""
                        }`}
                      >
                        {step.step}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {step.status === "completed"
                          ? "Complete"
                          : step.status === "in_progress"
                            ? "In progress"
                            : "Upcoming"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deliverables</CardTitle>
            <CardDescription>
              {files.length === 0
                ? "Files will appear here when your project is delivered"
                : `${files.length} file${files.length === 1 ? "" : "s"} available`}
            </CardDescription>
          </CardHeader>
          {files.length > 0 && (
            <CardContent>
              <div className="flex flex-col gap-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download className="size-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}
