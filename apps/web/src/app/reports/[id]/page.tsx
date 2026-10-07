"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { RadarLoader } from "@/components/RadarLoader";
import ReportImage from "@/components/ReportImage";
import type { Report } from "@stc-foundit/shared";

type ReportWithImages = Report & {
  report_images: { storage_path: string }[];
};

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [report, setReport] = useState<ReportWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [contacting, setContacting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: reportData }, { data: userData }] = await Promise.all([
        supabase
          .from("reports")
          .select("*, report_images(storage_path)")
          .eq("id", id)
          .single(),
        supabase.auth.getUser(),
      ]);
      setReport((reportData as ReportWithImages | null) ?? null);
      setUserId(userData.user?.id ?? null);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleContact() {
    if (!userId) {
      router.push("/login");
      return;
    }
    setContacting(true);
    setError(null);
    const { data: conversationId, error: rpcError } = await supabase.rpc(
      "start_conversation",
      { target_report_id: id }
    );
    setContacting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push(`/messages/${conversationId}`);
  }

  async function handleShare() {
    if (!report) return;
    const url = `${window.location.origin}/reports/${report.id}`;
    setShareStatus("");
    try {
      if (navigator.share) await navigator.share({ title: report.title, text: `FoundIt campus report: ${report.title}`, url });
      else { await navigator.clipboard.writeText(url); setShareStatus("Report link copied."); }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      setShareStatus("Could not share the report. Copy its address from your browser.");
    }
  }

  if (loading) {
    return <div className="stc-loading-state stc-loading-state-centered"><RadarLoader label="Loading report" /><span>Loading...</span></div>;
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted">Report not found.</p>
        <Link href="/reports" className="text-brand">
          Back to browse
        </Link>
      </div>
    );
  }

  const isLost = report.type === "lost";
  const isOwner = userId === report.user_id;
  const isResolved = report.status !== "active";

  async function handleMarkReturned() {
    if (!report) return;
    setUpdating(true);
    const { error: updateError } = await supabase
      .from("reports")
      .update({ status: "returned" })
      .eq("id", report.id);
    setUpdating(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setReport({ ...report, status: "returned" });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/reports" className="text-sm text-muted nav-link-glow">
        ← Back to browse
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{report.title}</h1>
        <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => void handleShare()} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted hover:border-brand/60 hover:text-brand">Share ↗</button><span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isResolved
              ? "bg-muted/20 text-muted"
              : isLost
              ? "bg-danger/15 text-danger"
              : "bg-success/15 text-success"
          }`}
        >
          {isResolved ? "Returned" : isLost ? "Lost" : "Found"}
        </span></div>
      </div>
      {shareStatus && <p role="status" className="mt-2 text-xs text-brand">{shareStatus}</p>}

      <div className="mt-2 flex gap-3 text-sm text-muted">
        <span>{report.category}</span>
        {report.location && <span>• {report.location}</span>}
        {report.incident_date && <span>• {report.incident_date}</span>}
      </div>

      <p className="mt-6 whitespace-pre-wrap">{report.description}</p>

      {report.report_images?.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {report.report_images.map((img, i) => (
            <ReportImage
              key={i}
              path={img.storage_path}
              alt={`${report.title} photo ${i + 1}`}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-8">
        {isOwner ? (
          isResolved ? (
            <p className="text-sm text-muted">
              This report is marked as returned. It no longer appears in the
              browse feed.
            </p>
          ) : (
            <>
              <button
                onClick={handleMarkReturned}
                disabled={updating}
                className="rounded-md border border-border px-5 py-2.5 font-medium hover:bg-surface disabled:opacity-50"
              >
                {updating ? "Updating..." : "Mark as returned"}
              </button>
              <p className="mt-2 text-xs text-muted">
                Once the item is back with its owner, mark this so it drops
                off the feed and out of future matches.
              </p>
            </>
          )
        ) : isResolved ? (
          <p className="text-sm text-muted">This item has already been returned.</p>
        ) : (
          <>
            <button
              onClick={handleContact}
              disabled={contacting}
              className="rounded-md bg-brand px-5 py-2.5 font-medium text-black hover:bg-brand-hover disabled:opacity-50"
            >
              {contacting
                ? "Starting conversation..."
                : isLost
                ? "I think this is mine"
                : "Contact finder"}
            </button>
            <p className="mt-2 text-xs text-muted">
              You&apos;ll need to describe a private detail (something not in
              this listing) so the other person can confirm it&apos;s really
              you before arranging a return
            </p>
          </>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
