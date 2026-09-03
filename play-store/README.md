# Kit de publicación — Google Play (PetPanic)

Material para subir PetPanic a Google Play. Generado 2026-06-02.

## Datos de la app
- **applicationId:** `com.petpanic.app`
- **Nombre:** PetPanic
- **versionName / versionCode:** 1.0 / 1
- **Política de privacidad:** https://app.petpanic.es/privacidad
- **Entidad:** La Gente de Tom S.L.U.

## Artefacto a subir
- **AAB firmado:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Rebuild** (requiere JDK 21):
  ```bash
  cd petpanic
  npm run build && npx cap sync android
  cd android
  JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew bundleRelease
  ```

## Contenido de este kit
| Archivo | Qué es | Estado |
|---|---|---|
| `LISTING-es.md` | Textos de la ficha (nombre, descripciones) | ✅ Listo para copiar/pegar |
| `DATA-SAFETY.md` | Respuestas del formulario Seguridad de los datos | ✅ Borrador (verificar) |
| `CONTENT-RATING.md` | Respuestas del cuestionario IARC | ✅ Borrador (verificar) |
| `play-icon-512.png` | Icono 512×512 para la ficha | ✅ Generado |
| `feature-graphic-1024x500.png` | Gráfico de cabecera | ✅ Generado (render HTML→PNG, marca PetPanic) |
| `screenshots/screenshot-{1,2,3}.png` | 3 frames 1080×1920 (hero / cómo funciona / qué hace) | ✅ Generados (frames de promoción branded) |

> **Nota sobre las capturas:** son **frames de promoción** diseñados con la marca, no
> capturas de la UI real (las pantallas internas están tras login y la landing pública usa
> animaciones por scroll que no renderizan en headless). Sirven para publicar ya; cuando
> tengamos la app logueada (vía extensión de Chrome o build local) se pueden sustituir por
> capturas reales con marco de móvil. Fuentes HTML en `assets/` y `assets/frames/`.

## Lo que falta y de quién depende
### Necesita tu cuenta (te guío)
1. **Firebase** → registrar `com.petpanic.app`, descargar `google-services.json` → me lo pasas y lo coloco en `android/app/` + rebuild (habilita push FCM).
2. **Supabase Pro** ($25/mes) → antes del test cerrado (el free tier auto-pausa).
3. **Play Console** → crear la app, subir el AAB, pegar los textos de este kit, rellenar
   Data Safety + content rating, configurar **test interno** + emails de testers.

## QA de release (verificado 2026-06-09)
- ✅ `targetSdk = 36`, `minSdk = 24`, `compileSdk = 36` → cumple el mínimo de Play (API 35).
- ✅ Firma release SHA-256 `13:DC:80:54:5B:15:76:06:CA:A7:AD:21:D2:D8:34:26:A4:9E:B1:69:D4:79:7F:A5:EA:23:8C:F4:56:A6:8A:61` coincide con `app.petpanic.es/.well-known/assetlinks.json` → App Links OK para instalaciones directas.
- ✅ Permisos: ACCESS_FINE/COARSE_LOCATION, CAMERA, READ_MEDIA_IMAGES, POST_NOTIFICATIONS, INTERNET, ACCESS_NETWORK_STATE, VIBRATE, WAKE_LOCK. Todos justificados; sin ACCESS_BACKGROUND_LOCATION (evita revisión extra de Play).
- ✅ AAB al día con `src/` (sin cambios desde el build). versionCode 1 / versionName 1.0.

## Runbook de subida a Play Console (día de subir)
1. **Firebase primero** (para el push): registra la app Android `com.petpanic.app`, descarga `google-services.json`, pásamelo → lo coloco en `android/app/` y reconstruyo el AAB.
2. **Supabase Pro** activado (evita auto-pausa durante el test).
3. Play Console → **Crear app** (PetPanic, español, app, gratis).
4. **Cerrar declaraciones**: Data Safety (`DATA-SAFETY.md`), Content rating (`CONTENT-RATING.md`), Público objetivo, App de gobierno=No, Anuncios=No.
5. **Ficha principal**: pegar de `LISTING-es.md`; subir `play-icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/screenshot-{1,2,3}.png`.
6. **Test interno** (o cerrado): crear pista, añadir emails de testers, **subir `app-release.aab`**.
7. ⚠️ **App Signing**: tras subir, Play re-firma con su propia clave. Copia el **SHA-256 de la "app signing key"** (Play Console → Configuración → Firma de apps) y **añádelo al `assetlinks.json`** (junto al actual) para que los App Links funcionen en instalaciones desde Play. El assetlinks se sirve desde el repo de la landing (`/.well-known/assetlinks.json`).
8. Enviar la pista de test → repartir el enlace de testers.

### Puedo hacerlo yo (a demanda)
- Colocar `google-services.json` y reconstruir el AAB (cuando me lo pases).
- Añadir el 2º SHA-256 al `assetlinks.json` (cuando tengas el de Play App Signing).
- Capturas reales de la app con marco de móvil (si abres la app logueada en Chrome).
