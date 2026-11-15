-- Add covering indexes for owner-scoped foreign keys.
create index if not exists media_assets_user_creator_idx on public.media_assets(user_id, creator_id);
create index if not exists content_items_user_creator_idx on public.content_items(user_id, creator_id);
create index if not exists content_items_user_contact_idx on public.content_items(user_id, contact_id);
