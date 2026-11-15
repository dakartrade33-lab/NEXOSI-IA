import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const BUCKET="nexora-media";
export async function POST(request:NextRequest){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const providerUrl=process.env.AVATAR_GENERATION_URL,providerKey=process.env.AVATAR_GENERATION_KEY;
  if(!providerUrl||!providerKey)return NextResponse.json({error:"generation_not_configured",message:"Aucun moteur de génération photoréaliste n’est connecté."},{status:503});
  let body:{creatorId?:string;prompt?:string;style?:string};
  try{body=await request.json()}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
  if(!body.creatorId||!body.prompt||body.prompt.length>4000)return NextResponse.json({error:"invalid_input"},{status:400});
  const {data:creator,error:creatorError}=await supabase.from("ai_creators").select("id,name,goal,visual_style").eq("id",body.creatorId).single();
  if(creatorError||!creator)return NextResponse.json({error:"creator_not_found"},{status:404});
  let endpoint:URL;try{endpoint=new URL(providerUrl);if(endpoint.protocol!=="https:")throw new Error()}catch{return NextResponse.json({error:"invalid_provider_config"},{status:500})}
  try{
    const generated=await fetch(endpoint,{method:"POST",redirect:"error",signal:AbortSignal.timeout(55_000),headers:{authorization:`Bearer ${providerKey}`,"content-type":"application/json",accept:"image/png, image/jpeg, image/webp, application/json"},body:JSON.stringify({prompt:body.prompt,creator_name:creator.name,goal:creator.goal,visual_style:creator.visual_style,width:1024,height:1024,photorealistic:true,synthetic_person:true})});
    if(!generated.ok)return NextResponse.json({error:"provider_failed",message:`Le moteur de génération a répondu (${generated.status}).`},{status:502});
    const declaredLength=Number(generated.headers.get("content-length")??0);if(declaredLength>20*1024*1024)return NextResponse.json({error:"image_too_large"},{status:502});
    const contentType=generated.headers.get("content-type")?.split(";")[0]??"";let bytes:Buffer;
    if(contentType==="application/json"){const payload=await generated.json() as {image_base64?:string};if(!payload.image_base64||payload.image_base64.length>21*1024*1024)return NextResponse.json({error:"invalid_provider_response"},{status:502});const data=payload.image_base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/,"");bytes=Buffer.from(data,"base64");}else bytes=Buffer.from(await generated.arrayBuffer());
    const signature=bytes.subarray(0,12);const detectedType=signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"image/png":signature.subarray(0,3).equals(Buffer.from([255,216,255]))?"image/jpeg":signature.subarray(0,4).toString()==="RIFF"&&signature.subarray(8,12).toString()==="WEBP"?"image/webp":"";
    if(!detectedType||!bytes.length||bytes.length>15*1024*1024||(contentType.startsWith("image/")&&contentType!==detectedType))return NextResponse.json({error:"invalid_image"},{status:502});
    const imageType=detectedType;
    const extension=imageType==="image/jpeg"?"jpg":imageType.split("/")[1];const objectPath=`${user.id}/avatars/${creator.id}-${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await supabase.storage.from(BUCKET).upload(objectPath,bytes,{contentType:imageType,cacheControl:"3600",upsert:false});if(uploadError)throw uploadError;
    const {error:metadataError}=await supabase.from("media_assets").insert({creator_id:creator.id,file_name:`${creator.name}-portrait.${extension}`,object_path:objectPath,mime_type:imageType,media_kind:"image",size_bytes:bytes.length});if(metadataError){await supabase.storage.from(BUCKET).remove([objectPath]);throw metadataError;}
    const {error:updateError}=await supabase.from("ai_creators").update({image_path:objectPath,generation_status:"ready"}).eq("id",creator.id);if(updateError)throw updateError;
    return NextResponse.json({ok:true,creatorId:creator.id,mediaPath:objectPath});
  }catch(error){console.error("Avatar generation failed",error instanceof Error?error.name:"unknown");return NextResponse.json({error:"generation_failed",message:"La génération a échoué. Vérifiez le moteur connecté et réessayez."},{status:502})}
}

