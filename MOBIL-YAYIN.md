# Mobil yayın (Google Play + App Store)

Uygulama kimliği: **`com.nimoriq.nfatower`** (yayından sonra değişmez). Sürüm: **0.1.0**.
Derleme GitHub'ın bulut makinelerinde yapılır; Android Studio ya da Mac gerekmez (Kelime Köyü ve Not a Fake Ad ile aynı düzen).
Telefonda görünen ad: **NFA Tower** (mağaza adı: *Not a Fake Ad: Tower*).

Oyun kabuğu: Capacitor 8. `npm run build` oyunu tek dosyalık `dist/app/index.html` yapar, Capacitor bunu
Android/iOS projelerine kopyalar.

## GitHub Secrets (Settings → Secrets and variables → Actions)

Not a Fake Ad'dekilerle **aynı değerler** (aynı yükleme anahtarı, alias `not-a-fake-ad-upload`). GitHub secret'ları repolar arasında kopyalanmaz, tek tek girilir.

| Ad | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | yükleme anahtarı `.jks` dosyasının base64 hali |
| `ANDROID_KEYSTORE_PASSWORD` | anahtar deposu şifresi |
| `ANDROID_KEY_ALIAS` | `not-a-fake-ad-upload` |
| `ANDROID_KEY_PASSWORD` | anahtar şifresi |
| `APPLE_TEAM_ID` | 10 karakterlik Team ID |
| `APPSTORE_KEY_ID` | App Store Connect API anahtar kimliği |
| `APPSTORE_ISSUER_ID` | Issuer ID |
| `APPSTORE_KEY_P8` | `AuthKey_XXXX.p8` dosyasının tam metni |

## Supabase

Adımlar: `supabase/BENI-OKU.md` (SQL + yönlendirme adresi `com.nimoriq.nfatower://auth-callback`).

## Google Play (kapalı test)

1. Play Console → **Uygulama oluştur**: ad *Not a Fake Ad: Tower*, varsayılan dil Türkçe, Oyun, Ücretsiz.
2. GitHub → Actions → **Android (Play)** → Run workflow → ~10 dk sonra çalıştırmanın altında `.aab` dosyası.
3. Play Console → Test → **Dahili test** → yeni sürüm → `.aab`'ı yükle → test kullanıcıları.
4. Mağaza metinleri ve formlar: gizlilik: nimoriq.com/nfa-tower-privacy/ · destek: nimoriq.com/nfa-tower-support/ · veri silme: nimoriq.com/nfa-tower-privacy/#silme

## App Store (TestFlight)

1. developer.apple.com → Identifiers → **+** → App ID: `com.nimoriq.nfatower` (yetenek gerekmez).
2. App Store Connect → Uygulamalar → **+** → Yeni uygulama: ad *Not a Fake Ad: Tower*, birincil dil Türkçe,
   paket kimliği `com.nimoriq.nfatower`, SKU `not-a-fake-tower`.
3. GitHub → Actions → **iOS (TestFlight)** → Run workflow (upload açık) → 5–30 dk sonra TestFlight'ta.
4. TestFlight → iç test grubuna kendini ekle.

İmzalama her çalıştırmada geçici bir dağıtım sertifikası açar ve bir önceki çalıştırmanınkini kapatır
(`scripts/asc.py`, ad öneki `NFATower CI`). Apple hesap başına birkaç dağıtım sertifikasına izin verir;
Kelime Köyü, Köstebek Avcısı ve Not a Fake Ad'in de birer tane tuttuğu için (dolarsa en eskisini kendisi siler) "sertifika sınırı" hatası çıkarsa
developer.apple.com → Certificates'ten eski "CI" sertifikalarından birini sil.

## Sürüm

Sürüm `android/app/build.gradle` → `versionName` (iOS da buradan okur). Derleme numarası = iş akışının çalıştırma
numarası (Android: `<run>00`), her yüklemede kendiliğinden artar. Sürüm değişince `build.gradle`,
`ios/App/App.xcodeproj/project.pbxproj` (MARKETING_VERSION) ve `package.json` birlikte değişir.

## Henüz test modunda olanlar (yayından önce bağlanacak)

| Ne | Şu an | Yayından önce |
|---|---|---|
| Giriş + bulut kaydı | **Gerçek** (Supabase) | — |
| Satın almalar | Sahte onay penceresi, para çekilmez | RevenueCat + mağazalarda 6 ürün |
| Reklamlar | **AdMob bağlı** (ödüllü birim), şimdilik Google'ın test reklamları | Yayın derlemesinden önce `src/ads.js` → `ADS_TESTING = false` |
| Game Center / Play Games, bildirimler | Kapalı | ilgili eklentiler |

Bu yüzden şimdiki build'ler **yalnızca dahili test / TestFlight** içindir; mağazaya incelemeye gönderilmez.

AdMob bağlı: Play Console → Uygulama içeriği → **Reklam kimliği** beyanı **"Evet"** (reklam), ve "Reklam içeriyor mu?" → **Evet**.
Uygulama kimlikleri Android `strings.xml` (`admob_app_id`) ve iOS `Info.plist` (`GADApplicationIdentifier`) içinde,
ödüllü birimler `src/ads.js` içinde. Avrupa onayı Google'ın formuyla (AdMob → Gizlilik ve mesajlaşma → GDPR mesajı).
Reklam gelmezse (yeni uygulama, doldurma yok) oyun ödülü yine sahte reklam ekranıyla verir, oyuncu takılmaz.
