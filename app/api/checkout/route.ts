import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      )
    }

    const projectSnap = await getDoc(doc(db, "projects", projectId))
    if (!projectSnap.exists()) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      )
    }

    const project = projectSnap.data()

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: project.title ?? "Media Production",
              description: project.description ?? undefined,
            },
            unit_amount: project.amountCents ?? 0,
          },
          quantity: 1,
        },
      ],
      metadata: { projectId },
      success_url: `${req.nextUrl.origin}/portal/${projectId}?payment=success`,
      cancel_url: `${req.nextUrl.origin}/portal/${projectId}?payment=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("Checkout error:", err)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    )
  }
}
