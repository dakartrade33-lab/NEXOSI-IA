# NEXORA AI Studio

Application Next.js pour un studio de contenu avec CRM clients, profils d’influenceurs IA, calendrier éditorial et bibliothèque privée de médias. Le projet utilise Supabase Auth, Postgres et Storage avec des règles RLS par utilisateur, puis peut être déployé sur Vercel.

## Démarrage

Prérequis : Node.js 20.9 ou supérieur, un projet Supabase et npm.

1. Copiez `.env.example` vers `.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL` ainsi que `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` depuis le panneau **Connect** de Supabase. Ne mettez jamais une clé `service_role` dans une variable `NEXT_PUBLIC_*` ni dans Git.
2. Pour un nouveau projet Supabase, exécutez tous les fichiers de `supabase/migrations/` dans l’ordre chronologique, puis configurez l’authentification par lien e-mail et ajoutez `http://localhost:3000/auth/callback` aux URL de redirection autorisées. Les migrations CRM/médias, index et agents vidéo sont déjà appliquées sur le projet Supabase relié à ce dépôt.
3. Installez les dépendances avec `npm install`, puis lancez `npm run dev`. Ouvrez `http://localhost:3000` et connectez-vous avec un lien envoyé par e-mail.

Le stockage `nexora-media` est privé. Les politiques Storage et RLS limitent les fichiers et les lignes au compte propriétaire. L’application limite les fichiers à 50 Mo et utilise des chargements TUS reprenables pour les vidéos. Ajustez cette limite aux quotas et paramètres de votre projet Supabase avant d’importer de gros médias.

## Influenceurs IA réalistes

Les fiches persona, prompts et objectifs sont enregistrés dans Supabase. L’action de génération photoréaliste est préparée côté serveur sur `/api/creators/generate`. Pour l’activer, choisissez un fournisseur d’images qui autorise les personnes synthétiques, puis configurez `AVATAR_GENERATION_URL` et `AVATAR_GENERATION_KEY` dans les variables d’environnement locales et Vercel.

Le fournisseur configuré doit accepter un `POST` JSON `{ "prompt", "creator_name", "goal", "visual_style", "width", "height", "photorealistic", "synthetic_person" }`, avec une authentification Bearer, et retourner soit directement une image PNG/JPEG/WebP, soit `{ "image_base64": "..." }`. Le serveur vérifie le type et la taille, puis enregistre le portrait dans le bucket privé. Sans fournisseur, les personas et le CRM fonctionnent, mais aucun vrai portrait n’est simulé ou promis. La génération de portraits et de vidéos réalistes implique généralement un service tiers et peut avoir un coût; aucun fournisseur payant n’est activé par défaut.

## Agents IA de montage vidéo

Le studio inclut une file de montage asynchrone, avec briefs privés par utilisateur, formats Shorts/Reels/TikTok/formation/publicité, sous-titres, suppression des silences, accroche et recadrage du sujet. Le rendu utilise un upload signé à usage limité vers le bucket Supabase privé; la vidéo terminée apparaît automatiquement dans la médiathèque après actualisation de son état.

Pour lancer les rendus, configurez un moteur de montage compatible dans `VIDEO_AGENT_URL` et `VIDEO_AGENT_API_KEY` (variables serveur uniquement, dans `.env.local` ou les variables privées Vercel). Aucun moteur n’est activé ou facturé par défaut. Le worker peut être auto-hébergé avec des outils ouverts comme FFmpeg et un moteur de transcription local; l’hébergement et le modèle choisi déterminent la vitesse et les coûts.

Le contrat worker attendu est volontairement compact : `POST /jobs` avec Bearer key reçoit `job_id`, `input` (`url`, `name`, `mime_type`, `size_bytes`), `output` (`bucket`, `path`, `upload_token`, `mime_type`), `platform`, `preset`, `instructions` et `options`. Il retourne `{ "job_id": "identifiant-du-job" }`. Il doit utiliser le lien source signé pour télécharger la vidéo, réaliser le montage, puis téléverser le MP4 dans le chemin de sortie avec `supabase.storage.from(bucket).uploadToSignedUrl(path, upload_token, file)`; le jeton d’envoi signé est valable deux heures. `GET /jobs/{identifiant-du-job}` retourne `{ "status": "queued|processing|completed|failed", "progress": 0-100, "error": "..." }`. Le partage de clés de service Supabase avec le worker n’est pas nécessaire. Consultez la [référence Supabase du téléversement signé](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl).

## GitHub et Vercel

1. Créez ou choisissez un dépôt GitHub, poussez le projet sans `.env.local`, puis importez ce dépôt depuis Vercel.
2. Dans **Vercel → Project → Settings → Environment Variables**, renseignez les deux variables Supabase; ajoutez `VIDEO_AGENT_URL` et `VIDEO_AGENT_API_KEY` après avoir hébergé un worker compatible, et les variables avatar seulement si vous avez choisi un fournisseur.
3. Dans **Supabase → Authentication → URL Configuration**, définissez l’URL publique Vercel comme Site URL et ajoutez `https://VOTRE-DOMAINE/auth/callback` aux redirections autorisées.
4. Déployez depuis Vercel. Chaque push sur la branche de production déclenchera un nouveau déploiement.

## Capacités et limites actuelles

- CRM : ajout, recherche et suppression de contacts avec étapes de pipeline.
- Influenceurs : enregistrement de personas; génération réelle de portraits via le contrat fournisseur ci-dessus.
- Médiathèque : import reprenable, métadonnées, aperçus à URL signée et isolation par utilisateur.
- Montage vidéo : briefs et file de tâches en base, formats sociaux, options de montage, dispatch asynchrone vers un worker et récupération privée du rendu. Le worker doit être hébergé et configuré pour effectuer le vrai rendu.
- Calendrier : création de contenus, brouillons et dates planifiées.
- La publication automatique vers les réseaux n’est pas encore branchée. Elle nécessite leurs applications développeur, les autorisations de compte adaptées et une tâche planifiée côté serveur; l’enregistrement d’une date dans le CRM ne publie rien.

## Stack et sécurité

Next.js App Router, React, TypeScript, Supabase SSR/Auth/Postgres/Storage, `tus-js-client`. Secrets uniquement côté serveur. La base comprend des politiques RLS et le bucket reste privé.

