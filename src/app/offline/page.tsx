import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline — UAV Operations Portal" };

/**
 * Served by the service worker when a navigation cannot reach the network.
 *
 * It says what still works rather than only what does not: a crew that knows
 * the flight log form is still usable will keep filing, and the queue will
 * catch up when they drive back into coverage.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <CloudOff className="size-10 text-[var(--status-warning)]" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">No signal out here</h1>
        <p className="text-sm text-muted-foreground">
          This page has not been visited on this device, so there is nothing cached to show. Pages
          you opened before going out of coverage still work.
        </p>
        <p className="text-sm text-muted-foreground">
          Flights you file while offline are held on the device and sent as soon as the connection
          returns — nothing is lost.
        </p>
      </div>
      <Button variant="outline" render={<Link href="/" />}>
        Try again
      </Button>
    </main>
  );
}
