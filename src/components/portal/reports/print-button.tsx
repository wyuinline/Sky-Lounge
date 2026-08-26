"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Printing needs the browser, so this one control is a client component while
 * the report itself stays server-rendered.
 */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="size-4" />
      Print / Save as PDF
    </Button>
  );
}
