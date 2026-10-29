# Supabase (Kelime Köyü projesi) — Tower için bir kez

Tower, Kelime Köyü ve Not a Fake Ad ile **aynı** Supabase projesini kullanır. Hesaplar üç oyunda ortaktır;
her oyunun kaydı kendi tablosundadır (Tower: `tower_saves`).

1. **SQL Editor** → `supabase/001_not_a_fake_tower.sql` dosyasının tamamını yapıştır → Run.
   Kontrol: `select relname, relrowsecurity from pg_class where relname = 'tower_saves';` → `tower_saves | true`
2. **SQL Editor** → Not a Fake Ad reposundaki `supabase/002_delete_account_knows_tower.sql` → Run.
   (Not a Fake Ad'den hesap silen biri Tower'da da oynuyorsa hesabı silinmesin diye.)
3. **Authentication → URL Configuration → Redirect URLs** → ekle: `com.nimoriq.nfatower://auth-callback`
   (Kelime Köyü'nün ve Not a Fake Ad'in adresleri listede kalır.)
4. E-posta şablonu, SMTP (Resend) ve Google/Apple sağlayıcıları zaten ayarlı; Tower aynılarını kullanır.

Oyuna sadece proje adresi ve publishable key girer (`src/cloud.js`); service/secret key asla oyuna girmez.
