import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

const DEFAULT_TIMELINE = [
  { step: "Deposit Paid", status: "completed" },
  { step: "Pre-Production", status: "pending" },
  { step: "Production", status: "pending" },
  { step: "Post-Production", status: "pending" },
  { step: "Review", status: "pending" },
  { step: "Delivered", status: "pending" },
]

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const projectId = session.metadata?.projectId

    if (projectId) {
      await updateDoc(doc(db, "projects", projectId), {
        stripeSessionId: session.id,
        amountPaid: (session.amount_total ?? 0) / 100,
        status: "active",
        timeline: DEFAULT_TIMELINE,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ received: true })
}
