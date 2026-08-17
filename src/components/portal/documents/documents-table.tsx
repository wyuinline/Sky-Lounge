"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documentCategories, labelForCategory, type DocumentCategory } from "@/lib/document-categories";
import { getDownloadUrl } from "@/app/(portal)/documents/actions";

export type DocumentRow = {
  id: string;
  title: string;
  category: DocumentCategory;
  version: number;
  approval_status: "draft" | "pending_approval" | "approved" | "published";
  storage_path: string;
  uploader: { full_name: string } | null;
  created_at: string;
};

const approvalVariant: Record<DocumentRow["approval_status"], "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  pending_approval: "secondary",
  approved: "default",
  published: "default",
};

export function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesCategory = category === "all" || row.category === category;
      const matchesSearch = search.trim() === "" || row.title.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [rows, search, category]);

  async function handleDownload(row: DocumentRow) {
    setDownloadingId(row.id);
    const result = await getDownloadUrl(row.storage_path, row.category);
    setDownloadingId(null);

    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not generate download link.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {documentCategories.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Approval Status</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead className="text-right">Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No documents uploaded yet." : "No documents match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{labelForCategory(row.category)}</TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>
                    <Badge variant={approvalVariant[row.approval_status]} className="capitalize">
                      {row.approval_status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.uploader?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === row.id}
                      onClick={() => handleDownload(row)}
                    >
                      <Download className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
