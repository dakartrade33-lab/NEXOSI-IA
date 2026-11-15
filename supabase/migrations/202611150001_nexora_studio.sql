-- NEXORA AI Studio: private CRM, creator profiles, media library and content calendar.

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 140),
  company text,
  email text,
  phone text,
  stage text not null default 'lead' check (stage in ('lead','active','paused','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.ai_creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  prompt text not null check (char_length(prompt) <= 4000),
  goal text not null default 'marketing' check (goal in ('marketing','training','community')),
  visual_style text not null default 'warm' check (visual_style in ('warm','expert','bold')),
  voice_description text,
  image_path text,
  voice_path text,
  generation_status text not null default 'draft' check (generation_status in ('draft','queued','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_id uuid,
  file_name text not null,
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  media_kind text not null check (media_kind in ('image','video','audio','document')),
  alt_text text,
  created_at timestamptz not null default now(),
  constraint media_creator_owner_fk foreign key (user_id, creator_id) references public.ai_creators(user_id, id)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_id uuid,
  contact_id uuid,
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '',
  platform text not null check (platform in ('youtube','tiktok','instagram','other')),
  status text not null default 'idea' check (status in ('idea','draft','review','scheduled','published','archived')),
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_creator_owner_fk foreign key (user_id, creator_id) references public.ai_creators(user_id, id),
  constraint content_contact_owner_fk foreign key (user_id, contact_id) references public.crm_contacts(user_id, id)
);

create index if not exists crm_contacts_user_stage_idx on public.crm_contacts(user_id, stage, updated_at desc);
create index if not exists ai_creators_user_created_idx on public.ai_creators(user_id, created_at desc);
create index if not exists media_assets_user_created_idx on public.media_assets(user_id, created_at desc);
create index if not exists content_items_user_calendar_idx on public.content_items(user_id, publish_at);
create index if not exists media_assets_user_creator_idx on public.media_assets(user_id, creator_id);
create index if not exists content_items_user_creator_idx on public.content_items(user_id, creator_id);
create index if not exists content_items_user_contact_idx on public.content_items(user_id, contact_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
create trigger crm_contacts_set_updated_at before update on public.crm_contacts for each row execute function public.set_updated_at();
create trigger ai_creators_set_updated_at before update on public.ai_creators for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute function public.set_updated_at();

alter table public.crm_contacts enable row level security;
alter table public.ai_creators enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_items enable row level security;

create policy "Users manage their CRM contacts" on public.crm_contacts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their AI creators" on public.ai_creators for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their media metadata" on public.media_assets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their content calendar" on public.content_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nexora-media','nexora-media',false,52428800,array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/wav','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload media to their private folder" on storage.objects for insert to authenticated with check (bucket_id = 'nexora-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read media in their private folder" on storage.objects for select to authenticated using (bucket_id = 'nexora-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update media in their private folder" on storage.objects for update to authenticated using (bucket_id = 'nexora-media' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'nexora-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete media in their private folder" on storage.objects for delete to authenticated using (bucket_id = 'nexora-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

