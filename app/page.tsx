import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Otter Media
        </h1>
        <p className="text-lg text-muted-foreground">
          Professional media production for brands that want to stand out.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href="/book">Book a Call</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/portal">Client Portal</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
