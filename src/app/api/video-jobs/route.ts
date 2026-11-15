import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const presets = ["shorts", "reels", "tiktok", "training", "promo"] as const;
const platforms = ["youtube", "instagram", "tiktok"] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Connectez-vous pour préparer un montage." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Requête invalide." }, { status: 400 }); }
  const sourceAssetId = typeof body.sourceAssetId === "string" ? body.sourceAssetId : "";
  const preset = presets.find((value) => value === body.preset);
  const platform = platforms.find((value) => value === body.platform);
  const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, 4000) : "";
  if (!sourceAssetId || !preset || !platform) return NextResponse.json({ message: "Choisissez une vidéo, un format et une plateforme." }, { status: 400 });

  const { data: source, error: sourceError } = await supabase.from("media_assets")
    .select("id,mime_type,media_kind").eq("id", sourceAssetId).single();
  if (sourceError || source.media_kind !== "video" || !source.mime_type.startsWith("video/")) {
    return NextResponse.json({ message: "La source doit être une vidéo de votre médiathèque." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const outputObjectPath = `${user.id}/exports/${id}.mp4`;
  const options = { captions: body.captions === true, removeSilences: body.removeSilences === true, openingHook: body.openingHook === true, reframing: body.reframing === true };
  const { data, error } = await supabase.from("video_edit_jobs").insert({
    id, source_asset_id: sourceAssetId, output_object_path: outputObjectPath, platform, preset, instructions, options,
  }).select("id,status,created_at").single();
  if (error) return NextResponse.json({ message: "Impossible de créer le montage. Vérifiez la migration Supabase." }, { status: 500 });
  return NextResponse.json({ job: data });
}

