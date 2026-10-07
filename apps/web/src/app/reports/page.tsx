"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import ReportImage from "@/components/ReportImage";
import { RadarLoader } from "@/components/RadarLoader";
import type { Report, ReportType, ReportCategory } from "@stc-foundit/shared";

const CATEGORIES: (ReportCategory | "all")[] = [
  "all",
  "electronics",
  "documents",
  "keys",
  "bags",
  "clothing",
  "accessories",
  "other",
];

type ReportWithImages = Report & {
  report_images: { storage_path: string }[];
};

export default function ReportsFeedPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<ReportWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "all">("all");

  useEffect(() => {
    let query = supabase
      .from("reports")
      .select("*, report_images(storage_path)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    setLoading(true);
    query.then(({ data }) => {
      setReports((data as ReportWithImages[] | null) ?? []);
      setLoading(false);
    });
  }, [typeFilter, categoryFilter]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Browse reports</h1>

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by report type">
          {(["all", "lost", "found"] as const).map((type) => (
            <button key={type} type="button" aria-pressed={typeFilter === type} onClick={() => setTypeFilter(type)} className={`filter-chip ${typeFilter === type ? "filter-chip-active" : ""}`}>
              {type === "all" ? "Everything" : type[0].toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {CATEGORIES.map((category) => (
            <button key={category} type="button" aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)} className={`filter-chip ${categoryFilter === category ? "filter-chip-active" : ""}`}>
              {category === "all" ? "All categories" : category[0].toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && <div className="stc-loading-state"><RadarLoader size="small" label="Loading reports" /><span>Loading...</span></div>}
        {!loading && reports.length === 0 && (
          <p className="text-muted">No reports match these filters yet.</p>
        )}
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: ReportWithImages }) {
  const isLost = report.type === "lost";
  const thumb = report.report_images?.[0]?.storage_path;
  return (
    <Link
      href={`/reports/${report.id}`}
      className="flex gap-3 rounded-lg border border-border bg-surface p-4 hover:border-brand"
    >
      {thumb && (
        <ReportImage
          path={thumb}
          alt={report.title}
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{report.title}</h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLost ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
            }`}
          >
            {isLost ? "Lost" : "Found"}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-muted">{report.description}</p>
        <div className="mt-2 flex gap-3 text-xs text-muted">
          <span>{report.category}</span>
          {report.location && <span>{report.location}</span>}
        </div>
      </div>
    </Link>
  );
}
