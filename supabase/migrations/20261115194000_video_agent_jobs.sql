-- Durable, user-scoped queue for asynchronous video editing agents.
alter table public.media_assets add constraint media_assets_user_id_id_key unique (user_id, id);

create table public.video_edit_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_asset_id uuid not null,
  output_asset_id uuid,
  output_object_path text not null,
  provider_job_id text,
  platform text not null check (platform in ('youtube','tiktok','instagram')),
  preset text not null check (preset in ('shorts','reels','tiktok','training','promo')),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  options jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_job_source_owner_fk foreign key (user_id, source_asset_id) references public.media_assets(user_id, id),
  constraint video_job_output_owner_fk foreign key (user_id, output_asset_id) references public.media_assets(user_id, id)
);

create index video_edit_jobs_user_created_idx on public.video_edit_jobs(user_id, created_at desc);
create index video_edit_jobs_source_idx on public.video_edit_jobs(user_id, source_asset_id);
create index video_edit_jobs_output_idx on public.video_edit_jobs(user_id, output_asset_id);
create index video_edit_jobs_active_idx on public.video_edit_jobs(user_id, status) where status in ('queued','processing');

create trigger video_edit_jobs_set_updated_at before update on public.video_edit_jobs
for each row execute function public.set_updated_at();

alter table public.video_edit_jobs enable row level security;
create policy "Users manage their video editing jobs" on public.video_edit_jobs
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

