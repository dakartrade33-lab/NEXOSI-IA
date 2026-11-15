import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Connectez-vous pour lancer l’agent." }, { status: 401 });
  const { id } = await params;
  const { data: job, error } = await supabase.from("video_edit_jobs").select("*").eq("id", id).single();
  if (error || !job) return NextResponse.json({ message: "Montage introuvable." }, { status: 404 });
  if (job.status === "processing" || job.status === "completed") return NextResponse.json({ job });
  const endpoint = process.env.VIDEO_AGENT_URL?.replace(/\/$/, "");
  const key = process.env.VIDEO_AGENT_API_KEY;
  if (!endpoint || !key) return NextResponse.json({ code: "agent_not_configured", message: "L’agent de montage n’est pas encore connecté. Configurez le moteur vidéo dans les variables privées Vercel." }, { status: 503 });

  const { data: source } = await supabase.from("media_assets").select("object_path,file_name,mime_type,size_bytes").eq("id", job.source_asset_id).single();
  if (!source || !source.mime_type.startsWith("video/")) return NextResponse.json({ message: "Vidéo source indisponible." }, { status: 400 });
  const { data: signedSource, error: signedSourceError } = await supabase.storage.from("nexora-media").createSignedUrl(source.object_path, 3600);
  const { data: signedOutput, error: signedOutputError } = await supabase.storage.from("nexora-media").createSignedUploadUrl(job.output_object_path);
  if (signedSourceError || signedOutputError || !signedSource || !signedOutput) return NextResponse.json({ message: "Impossible de préparer les liens privés du montage." }, { status: 500 });

  try {
    const response = await fetch(`${endpoint}/jobs`, {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        job_id: job.id, input: { url: signedSource.signedUrl, name: source.file_name, mime_type: source.mime_type, size_bytes: source.size_bytes },
        output: { bucket: "nexora-media", path: job.output_object_path, upload_token: signedOutput.token, mime_type: "video/mp4" },
        platform: job.platform, preset: job.preset, instructions: job.instructions, options: job.options,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.job_id !== "string") throw new Error(typeof result.message === "string" ? result.message : "Le moteur vidéo n’a pas accepté la tâche.");
    const { data: updated, error: updateError } = await supabase.from("video_edit_jobs").update({ provider_job_id: result.job_id, status: "processing", progress: 1 }).eq("id", id).select("id,status,progress").single();
    if (updateError) throw new Error("L’agent a démarré, mais le suivi du montage n’a pas pu être enregistré.");
    return NextResponse.json({ job: updated });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 500) : "Le moteur vidéo est indisponible.";
    await supabase.from("video_edit_jobs").update({ status: "failed", error_message: message }).eq("id", id);
    return NextResponse.json({ message }, { status: 502 });
  }
}

