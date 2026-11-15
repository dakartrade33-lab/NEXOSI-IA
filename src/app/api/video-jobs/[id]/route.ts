import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Connectez-vous pour actualiser le montage." }, { status: 401 });
  const { id } = await params;
  const { data: job, error } = await supabase.from("video_edit_jobs").select("*").eq("id", id).single();
  if (error || !job) return NextResponse.json({ message: "Montage introuvable." }, { status: 404 });
  if (job.status !== "processing" || !job.provider_job_id) return NextResponse.json({ job });
  const endpoint = process.env.VIDEO_AGENT_URL?.replace(/\/$/, "");
  const key = process.env.VIDEO_AGENT_API_KEY;
  if (!endpoint || !key) return NextResponse.json({ job });

  try {
    const response = await fetch(`${endpoint}/jobs/${encodeURIComponent(job.provider_job_id)}`, {
      headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("État du moteur vidéo indisponible.");
    const remote = await response.json();
    const status = ["queued", "processing", "completed", "failed"].includes(remote.status) ? remote.status : "processing";
    const progress = Math.max(0, Math.min(100, Math.round(Number(remote.progress) || (status === "completed" ? 100 : job.progress))));
    if (status === "failed") {
      const message = typeof remote.error === "string" ? remote.error.slice(0, 500) : "Le moteur vidéo a signalé une erreur.";
      const { data: updated } = await supabase.from("video_edit_jobs").update({ status, progress, error_message: message }).eq("id", id).select("*").single();
      return NextResponse.json({ job: updated ?? { ...job, status, progress, error_message: message } });
    }
    if (status === "completed") {
      const folder = `${user.id}/exports`;
      const fileName = job.output_object_path.split("/").at(-1)!;
      const { data: files, error: listError } = await supabase.storage.from("nexora-media").list(folder, { search: fileName, limit: 10 });
      const output = files?.find((file) => file.name === fileName);
      if (!listError && output) {
        let outputAssetId = job.output_asset_id as string | null;
        if (!outputAssetId) {
          const { data: asset, error: assetError } = await supabase.from("media_assets").insert({
            file_name: `Montage ${job.preset} · ${fileName}`, object_path: job.output_object_path, mime_type: "video/mp4",
            media_kind: "video", size_bytes: Math.max(1, Number(output.metadata?.size ?? 1)),
          }).select("id").single();
          if (assetError) throw new Error("Le montage est prêt, mais son enregistrement dans la médiathèque a échoué.");
          outputAssetId = asset.id;
        }
        const { data: updated } = await supabase.from("video_edit_jobs").update({ status, progress: 100, output_asset_id: outputAssetId, error_message: null }).eq("id", id).select("*").single();
        return NextResponse.json({ job: updated ?? { ...job, status, progress: 100, output_asset_id: outputAssetId } });
      }
      // The worker reports completion before the signed upload becomes visible in Storage.
      return NextResponse.json({ job: { ...job, progress: Math.max(job.progress, 95) } });
    }
    const { data: updated } = await supabase.from("video_edit_jobs").update({ status, progress }).eq("id", id).select("*").single();
    return NextResponse.json({ job: updated ?? { ...job, status, progress } });
  } catch (cause) {
    return NextResponse.json({ message: cause instanceof Error ? cause.message : "Impossible d’actualiser le montage." }, { status: 502 });
  }
}

