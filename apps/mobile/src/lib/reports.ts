import { supabase } from "./supabase";
import type { MobileReport } from "../components/ReportCard";

export async function withPhotoUrls<T extends { id: string; report_images?: { storage_path: string }[] }>(rows: T[]) {
  const paths = [...new Set(rows.flatMap((row) => row.report_images?.map((image) => image.storage_path) ?? []))];
  const signed = paths.length
    ? await supabase.storage.from("report-images").createSignedUrls(paths, 60 * 30)
    : { data: [], error: null };
  const urlByPath = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return rows.map((row) => ({ ...row, photoUrl: row.report_images?.[0]?.storage_path ? urlByPath.get(row.report_images[0].storage_path) ?? null : null }));
}

export async function loadReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("*, report_images(storage_path)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (await withPhotoUrls((data ?? []) as (MobileReport & { report_images?: { storage_path: string }[] })[])) as MobileReport[];
}

export function friendlyError(message: string) {
  if (message.includes("relation") || message.includes("schema cache")) {
    return "This Supabase project is missing one of FoundIt’s database updates. Apply the migrations from the project before using this feature.";
  }
  if (message.includes("JWT") || message.includes("token")) return "Your sign-in expired. Please sign in again.";
  return message;
}
