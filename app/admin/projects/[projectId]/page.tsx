"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
} from "firebase/firestore"
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Check,
  Download,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react"

interface TimelineStep {
  step: string
  status: "completed" | "in_progress" | "pending"
}

interface ProjectFile {
  id: string
  name: string
  storagePath: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

interface ProjectData {
  title: string
  description?: string
  status: string
  clientId: string
  clientEmail?: string
  amountCents?: number
  amountPaid?: number
  createdAt: string
  timeline?: TimelineStep[]
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

const DEFAULT_TIMELINE: TimelineStep[] = [
  { step: "Deposit Paid", status: "completed" },
  { step: "Pre-Production", status: "pending" },
  { step: "Production", status: "pending" },
  { step: "Post-Production", status: "pending" },
  { step: "Review", status: "pending" },
  { step: "Delivered", status: "pending" },
]

export default function ManageProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const projectSnap = await getDoc(doc(db, "projects", projectId))
    if (projectSnap.exists()) {
      const data = projectSnap.data() as ProjectData

      const userSnap = await getDoc(doc(db, "users", data.clientId))
      if (userSnap.exists()) {
        data.clientEmail = userSnap.data().email
      }

      setProject(data)
    }

    const filesSnap = await getDocs(
      collection(db, "projects", projectId, "files"),
    )
    setFiles(
      filesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ProjectFile,
      ),
    )
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function updateTimeline(index: number, newStatus: string) {
    if (!project?.timeline) return
    setSaving(true)

    const updated = project.timeline.map((step, i) => ({
      ...step,
      status: i === index ? newStatus : step.status,
    }))

    await updateDoc(doc(db, "projects", projectId), {
      timeline: updated,
      updatedAt: new Date().toISOString(),
    })

    setProject({ ...project, timeline: updated as TimelineStep[] })
    setSaving(false)
  }

  async function initializeTimeline() {
    if (!project) return
    setSaving(true)
    await updateDoc(doc(db, "projects", projectId), {
      timeline: DEFAULT_TIMELINE,
      status: "active",
      updatedAt: new Date().toISOString(),
    })
    setProject({
      ...project,
      timeline: DEFAULT_TIMELINE,
      status: "active",
    })
    setSaving(false)
  }

  async function markCompleted() {
    if (!project) return
    setSaving(true)
    await updateDoc(doc(db, "projects", projectId), {
      status: "completed",
      updatedAt: new Date().toISOString(),
    })
    setProject({ ...project, status: "completed" })
    setSaving(false)
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const filesToUpload = Array.from(fileList)
    if (filesToUpload.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      const storagePath = `projects/${projectId}/${file.name}`
      const storageRef = ref(storage, storagePath)

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file)
        task.on(
          "state_changed",
          (snap) => {
            const fileProgress = snap.bytesTransferred / snap.totalBytes
            const overall =
              (i + fileProgress) / filesToUpload.length
            setUploadProgress(Math.round(overall * 100))
          },
          reject,
          async () => {
            const downloadUrl = await getDownloadURL(storageRef)
            await addDoc(
              collection(db, "projects", projectId, "files"),
              {
                name: file.name,
                storagePath,
                downloadUrl,
                size: file.size,
                uploadedAt: new Date().toISOString(),
              },
            )
            resolve()
          },
        )
      })
    }

    setUploading(false)
    setUploadProgress(0)
    fetchData()
  }

  async function deleteFile(file: ProjectFile) {
    try {
      await deleteObject(ref(storage, file.storagePath))
    } catch {
      // File may already be deleted from storage
    }
    await deleteDoc(doc(db, "projects", projectId, "files", file.id))
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button asChild variant="outline">
          <Link href="/admin">Back to Dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center justify-between">
          <h1 className="text-2xl font-bold">{project.title}</h1>
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
      </div>

      {/* Info card */}
      <Card size="sm">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-medium">
              {project.clientEmail ?? project.clientId}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-medium">
              {project.amountPaid
                ? `$${project.amountPaid} (paid)`
                : project.amountCents
                  ? `$${(project.amountCents / 100).toFixed(2)} (pending)`
                  : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">
              {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {!project.timeline && project.status === "active" && (
          <Button onClick={initializeTimeline} disabled={saving} size="sm">
            Initialize Timeline
          </Button>
        )}
        {project.status !== "completed" && project.timeline && (
          <Button
            variant="outline"
            onClick={markCompleted}
            disabled={saving}
            size="sm"
          >
            <Check className="size-4" />
            Mark Completed
          </Button>
        )}
      </div>

      <Separator />

      {/* Timeline manager */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
          <CardDescription>
            {project.timeline
              ? "Update the status of each step"
              : "Timeline will be initialized after payment"}
          </CardDescription>
        </CardHeader>
        {project.timeline && (
          <CardContent>
            <div className="flex flex-col gap-3">
              {project.timeline.map((step, i) => (
                <div
                  key={step.step}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <span className="font-medium">{step.step}</span>
                  <Select
                    value={step.status}
                    onValueChange={(val) => updateTimeline(i, val)}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">
                        In Progress
                      </SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Separator />

      {/* File uploader */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliverables</CardTitle>
          <CardDescription>
            Upload finished media files for the client to download
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Uploading... {uploadProgress}%
                </p>
              </>
            ) : (
              <>
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag files here or click to browse
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files)
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)} &middot;{" "}
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download className="size-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteFile(file)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
