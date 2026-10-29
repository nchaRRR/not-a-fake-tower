-- =====================================================================================
-- Not a Fake Ad: Tower — Supabase kurulumu (Kelime Köyü ve Not a Fake Ad ile AYNI projede)
--
-- Supabase Dashboard → SQL Editor'da BİR KEZ çalıştırın. Tekrar çalıştırmak güvenlidir
-- (idempotent): tablo/politika varsa yeniden oluşturulmaz, veri silinmez.
--
-- Bu dosya Kelime Köyü'nün ve Not a Fake Ad'in hiçbir tablosuna dokunmaz. Her şey "tower_"
-- önekiyle ayrı durur:
--   tower_saves               oyun kaydı (tek satır / oyuncu, JSON)
--   tower_delete_my_account() oyuncunun bu oyundaki verisini siler (App Store 5.1.1(v), Play)
--
-- Hesaplar üç oyunda ortaktır (auth.users). Bu yüzden:
--   - Tower'dan "Hesabı sil" → bu oyunun kaydı silinir. Oyuncunun Kelime Köyü'nde ya da Not a Fake Ad'de
--     verisi YOKSA kullanıcı da tamamen silinir; VARSA kullanıcı kalır, diğer oyunlardaki ilerlemesi korunur.
--   - Kelime Köyü'nden "Hesabı sil" (delete_my_account) kullanıcıyı siler; on delete cascade
--     sayesinde bu oyunun kaydı da onunla birlikte silinir. Ek bir şey yapmaya gerek yok.
--
-- Güvenlik:
--   - RLS açık. Oyuncu yalnızca kendi satırını okur / ekler / günceller (auth.uid() = user_id).
--   - Silme politikası yok; silme yalnızca tower_delete_my_account() ile, yalnızca kendi verisi.
--   - "anon" rolüne hiçbir yetki verilmez.
-- =====================================================================================

-- ------------------------------------------------------------------ yardımcı: updated_at
create or replace function public.tower_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ tower_saves
create table if not exists public.tower_saves (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  save_data   jsonb not null,
  level       integer generated always as (
                case when jsonb_typeof(save_data -> 'level') = 'number'
                     then (save_data ->> 'level')::numeric::integer end
              ) stored,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint tower_saves_data_chk check (jsonb_typeof(save_data) = 'object'),
  -- Kötüye kullanım sınırı: tek kayıt en fazla ~256 KB (oyunun kaydı 10 KB civarı)
  constraint tower_saves_size_chk check (pg_column_size(save_data) < 262144)
);

-- updated_at her yazımda SUNUCU saatiyle yazılır
drop trigger if exists tower_saves_touch on public.tower_saves;
create trigger tower_saves_touch before insert or update on public.tower_saves
  for each row execute function public.tower_touch_updated_at();

alter table public.tower_saves enable row level security;

drop policy if exists tower_saves_select_own on public.tower_saves;
create policy tower_saves_select_own on public.tower_saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists tower_saves_insert_own on public.tower_saves;
create policy tower_saves_insert_own on public.tower_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists tower_saves_update_own on public.tower_saves;
create policy tower_saves_update_own on public.tower_saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.tower_saves from anon, public;
grant select, insert, update on public.tower_saves to authenticated;

-- ------------------------------------------------------------------ hesap silme
-- Bu oyunun verisini siler. Kullanıcının Kelime Köyü'nde (ya da ileride başka bir oyunda)
-- verisi yoksa auth.users satırını da siler. Dönüş: {"user_deleted": true|false}
create or replace function public.tower_delete_my_account()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  elsewhere boolean := false;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.tower_saves where user_id = me;

  -- Not a Fake Ad'de kaydı var mı?
  if to_regclass('public.nfa_saves') is not null then
    execute 'select exists (select 1 from public.nfa_saves where user_id = $1)' into elsewhere using me;
  end if;
  -- Kelime Köyü tabloları bu projede var mı, varsa oyuncunun orada verisi var mı?
  if not elsewhere and to_regclass('public.player_saves') is not null then
    execute 'select exists (select 1 from public.player_saves where user_id = $1)' into elsewhere using me;
  end if;
  if not elsewhere and to_regclass('public.profiles') is not null then
    execute 'select exists (select 1 from public.profiles where id = $1)' into elsewhere using me;
  end if;
  if not elsewhere and to_regclass('public.player_stats') is not null then
    execute 'select exists (select 1 from public.player_stats where user_id = $1)' into elsewhere using me;
  end if;
  -- Yönetici hesabı yanlışlıkla silinmesin
  if not elsewhere and to_regclass('public.admins') is not null then
    execute 'select exists (select 1 from public.admins where user_id = $1)' into elsewhere using me;
  end if;

  if not elsewhere then
    delete from auth.users where id = me;
  end if;
  return jsonb_build_object('user_deleted', not elsewhere);
end;
$$;
revoke execute on function public.tower_delete_my_account() from public, anon;
grant execute on function public.tower_delete_my_account() to authenticated;

-- ------------------------------------------------------------------ kontrol
-- Çalıştırdıktan sonra şu sorgu "tower_saves | true" döndürmeli (RLS açık):
--   select relname, relrowsecurity from pg_class where relname = 'tower_saves';
