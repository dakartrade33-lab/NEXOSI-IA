"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [email,setEmail]=useState(""),[sent,setSent]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const supabase=createClient();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/studio`}});if(error)throw error;setSent(true)}catch(err){setError(err instanceof Error?err.message:"Connexion impossible pour le moment.")}finally{setBusy(false)}}
  return <main className="login-page"><Link className="wordmark" href="/"><span>N</span>NEXORA<i>AI</i></Link><section className="login-card"><div className="eyebrow"><span/> ESPACE PRIVÉ</div><h1>Votre studio<br/><em>commence ici.</em></h1><p>Recevez un lien sécurisé pour ouvrir votre espace NEXORA.</p>{sent?<div className="success-box">✓ Le lien de connexion a été envoyé à <b>{email}</b>. Vérifiez votre boîte de réception.</div>:<form onSubmit={submit}><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@exemple.com"/><button className="solid-btn" disabled={busy}>{busy?"Envoi…":"M’envoyer le lien sécurisé ↗"}</button>{error&&<div className="error-box">{error}</div>}</form>}<small>Connexion sans mot de passe, fournie par Supabase Auth.</small></section><Link className="back-home" href="/">← Retour au site</Link></main>
}

