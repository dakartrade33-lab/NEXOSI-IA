# NEXORA AI Studio

Application Next.js pour un studio de contenu avec CRM clients, profils d’influenceurs IA, calendrier éditorial et bibliothèque privée de médias. Le projet utilise Supabase Auth, Postgres et Storage avec des règles RLS par utilisateur, puis peut être déployé sur Vercel.

## Démarrage

Prérequis : Node.js 20.9 ou supérieur, un projet Supabase et npm.

1. Copiez `.env.example` vers `.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL` ainsi que `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` depuis le panneau **Connect** de Supabase. Ne mettez jamais une clé `service_role` dans une variable `NEXT_PUBLIC_*` ni dans Git.
2. Dans Supabase, ouvrez **SQL Editor**, exécutez `supabase/migrations/202611150001_nexora_studio.sql`, puis configurez l’authentification par lien e-mail et ajoutez `http://localhost:3000/auth/callback` aux URL de redirection autorisées.
3. Installez les dépendances avec `npm install`, puis lancez `npm run dev`. Ouvrez `http://localhost:3000` et connectez-vous avec un lien envoyé par e-mail.

Le stockage `nexora-media` est privé. Les politiques Storage et RLS limitent les fichiers et les lignes au compte propriétaire. L’application limite les fichiers à 50 Mo et utilise des chargements TUS reprenables pour les vidéos. Ajustez cette limite aux quotas et paramètres de votre projet Supabase avant d’importer de gros médias.

## Influenceurs IA réalistes

Les fiches persona, prompts et objectifs sont enregistrés dans Supabase. L’action de génération photoréaliste est préparée côté serveur sur `/api/creators/generate`. Pour l’activer, choisissez un fournisseur d’images qui autorise les personnes synthétiques, puis configurez `AVATAR_GENERATION_URL` et `AVATAR_GENERATION_KEY` dans les variables d’environnement locales et Vercel.

Le fournisseur configuré doit accepter un `POST` JSON `{ "prompt", "creator_name", "goal", "visual_style", "width", "height", "photorealistic", "synthetic_person" }`, avec une authentification Bearer, et retourner soit directement une image PNG/JPEG/WebP, soit `{ "image_base64": "..." }`. Le serveur vérifie le type et la taille, puis enregistre le portrait dans le bucket privé. Sans fournisseur, les personas et le CRM fonctionnent, mais aucun vrai portrait n’est simulé ou promis. La génération de portraits et de vidéos réalistes implique généralement un service tiers et peut avoir un coût; aucun fournisseur payant n’est activé par défaut.

## GitHub et Vercel

1. Créez ou choisissez un dépôt GitHub, poussez le projet sans `.env.local`, puis importez ce dépôt depuis Vercel.
2. Dans **Vercel → Project → Settings → Environment Variables**, renseignez les deux variables Supabase; ajoutez aussi les variables du fournisseur d’avatars seulement si vous l’avez choisi.
3. Dans **Supabase → Authentication → URL Configuration**, définissez l’URL publique Vercel comme Site URL et ajoutez `https://VOTRE-DOMAINE/auth/callback` aux redirections autorisées.
4. Déployez depuis Vercel. Chaque push sur la branche de production déclenchera un nouveau déploiement.

## Capacités et limites actuelles

- CRM : ajout, recherche et suppression de contacts avec étapes de pipeline.
- Influenceurs : enregistrement de personas; génération réelle de portraits via le contrat fournisseur ci-dessus.
- Médiathèque : import reprenable, métadonnées, aperçus à URL signée et isolation par utilisateur.
- Calendrier : création de contenus, brouillons et dates planifiées.
- La publication automatique vers les réseaux n’est pas encore branchée. Elle nécessite leurs applications développeur, les autorisations de compte adaptées et une tâche planifiée côté serveur; l’enregistrement d’une date dans le CRM ne publie rien.

## Stack et sécurité

Next.js App Router, React, TypeScript, Supabase SSR/Auth/Postgres/Storage, `tus-js-client`. Secrets uniquement côté serveur. La base comprend des politiques RLS et le bucket reste privé.

