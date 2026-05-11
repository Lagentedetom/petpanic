# Cliente: cambios necesarios antes de aplicar `20260506000000_security_tightening.sql`

> ⚠️ **No apliques la migración SQL antes de desplegar estos cambios al cliente.**
> Si lo haces, la app dejará de funcionar para todos los usuarios mientras
> Netlify no haya servido la build nueva. El orden correcto es:
>
> 1. Aplica los cambios de este documento al código React
> 2. `npm run build` + `netlify deploy --prod` (sitio `petpanic`)
> 3. Una vez la nueva build esté servida, aplica la migración SQL en Supabase
> 4. Smoke test con un usuario real desde el iPhone simulator

---

## Cambios obligatorios (sin estos, la app rompe)

### 1. `src/context/AppContext.tsx` L500 — `searchUsers`

**Antes:**
```ts
const { data } = await supabase.from('profiles').select('*')
  .or(`display_name.ilike.%${q}%,friend_code.eq.${q.toUpperCase()}`)
  .limit(20);
```

**Después:**
```ts
const { data } = await supabase.from('public_profiles').select('*')
  .or(`display_name.ilike.%${q}%,friend_code.eq.${q.toUpperCase()}`)
  .limit(20);
```

**Por qué:** la tabla `profiles` queda restringida a self + friends. La vista `public_profiles` expone solo `id, display_name, photo_url, friend_code` y es accesible por todos los autenticados. Es lo único que el buscador necesita.

> **Tipo TypeScript:** `searchUsers` devuelve `UserProfile[]`. Los campos perdidos (`email`, `last_location`, etc.) NO los usaba el buscador. Si el tipo se queja, ajusta el cast a un subset:
> ```ts
> type SearchableProfile = Pick<UserProfile, 'id' | 'display_name' | 'photo_url' | 'friend_code'>;
> ```

---

### 2. `src/context/AppContext.tsx` L507 — `sendFriendRequest` → RPC

**Antes:**
```ts
await supabase.from('friendships').insert({
  requester_id: user.id,
  addressee_id: target.id,
  status: 'pending'
});
```

**Después:**
```ts
const { error } = await supabase.rpc('send_friend_request', {
  p_friend_code: target.friend_code,
});
if (error) {
  if (error.message?.includes('invalid_friend_code'))   throw new Error('Código de amigo no válido');
  if (error.message?.includes('friendship_exists'))     throw new Error('Ya hay una solicitud entre vosotros');
  if (error.message?.includes('social_required'))       throw new Error('Necesitas PetPanic Social para enviar solicitudes');
  throw error;
}
```

**Por qué:** la migración hace `REVOKE INSERT ON friendships FROM authenticated` (CR-06). Toda creación de amistad pasa por la RPC `send_friend_request`, que valida el código + comprueba el plan Social + bloquea duplicados.

**Nota sobre el flujo de "buscar y enviar":** ahora el cliente busca por código → llama a la RPC pasando ese mismo código. NO necesitas conocer el `id` del addressee de antemano; la RPC lo resuelve internamente. Si tu UI aceptaba enviar solicitud a un perfil ya cargado, basta con usar `target.friend_code`.

---

### 3. `src/pages/PublicPetPage.tsx` L16-L19 — usar vistas públicas

**Antes:**
```ts
const { data } = await supabase.from('pets').select('*').eq('id', petId).single();
if (data) {
  setPet(data);
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.owner_id).single();
  if (profile) setOwnerName(profile.display_name);
}
```

**Después:**
```ts
const { data } = await supabase.from('public_pets').select('*').eq('id', petId).single();
if (data) {
  setPet(data);
  const { data: profile } = await supabase.from('public_profiles').select('display_name').eq('id', data.owner_id).single();
  if (profile) setOwnerName(profile.display_name);
}
```

**Por qué:** `pets` queda owner-only. La vista `public_pets` es accesible para anon (es la página del QR, sin login). Devuelve los mismos campos que antes EXCEPTO que `contact_info` viene `null` cuando la mascota NO está perdida — exactamente lo que la UI ya espera (el botón "Llamar al dueño" solo aparece si `is_lost === true`).

**Pequeño detalle:** la vista `public_pets` no incluye `created_at`. Si tu UI lo usa (no creo, miré el archivo), añádelo a la vista en la migración antes de aplicar.

---

### 4. `src/pages/ZoneDetailsPage.tsx` ~L81 — count para no-miembros via RPC

Si la página muestra "X personas paseando" a usuarios que NO son miembros de la zona, esa vista hoy lee `zone_presence` directamente. Después de la migración, los no-miembros recibirán 0 rows.

**Cambio sugerido** (no he leído el archivo entero, comprueba el patrón):

```ts
// Para no-miembros, usa RPC para obtener solo el count:
if (!selectedZone?.is_member) {
  const { data: count } = await supabase.rpc('zone_presence_count', { p_zone_id: zoneId });
  setPresenceCount(count ?? 0);
  setZonePresence([]);
  return;
}

// Para miembros, lectura completa como antes:
const { data } = await supabase.from('zone_presence').select('*').eq('zone_id', zoneId);
setZonePresence(data ?? []);
setPresenceCount((data ?? []).length);
```

**Si la UI nunca muestra count a no-miembros**, este cambio no hace falta — la rama `if (!selectedZone?.is_member)` que ya tienes (clear state to []) seguirá funcionando.

---

## Cambios FUERTEMENTE recomendados (no rompen pero son del mismo release)

### 5. `src/context/AppContext.tsx` L189 — usar `nearby_alerts` RPC (HI-08)

**Antes:**
```ts
const { data } = await supabase.from('alerts').select('*').eq('status', 'active').order('created_at', { ascending: false });
// ...filter client-side by calculateDistance
```

**Después:**
```ts
if (!location) {
  setActiveAlerts([]); // sin GPS no hay alertas cercanas
  return;
}
const { data } = await supabase.rpc('nearby_alerts', {
  user_lat: location.lat,
  user_lng: location.lng,
  radius_km: 5,
});
setActiveAlerts(data ?? []);
```

**Por qué:** hoy el cliente trae TODAS las alertas activas y filtra en JS. Con la nueva RLS (`status='active' OR mine`) sigue funcionando, pero estás bajando potencialmente miles de filas para mostrar 3. La RPC `nearby_alerts` ya existe (PostGIS server-side) y devuelve solo lo cercano. Mismo resultado, fracción del payload, y respeta privacy de alertas lejanas.

---

### 6. `supabase/functions/delete-account/index.ts` — CORS en errores (CR-05)

Cada `new Response(...)` que devuelva 401 o 500 debe incluir los `corsHeaders`. Hoy solo el path 200 los lleva.

**Patch sugerido:**

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Cambiar TODOS los `new Response(...)` para usar:
return new Response(JSON.stringify({ error: "..." }), {
  status: 401,
  headers: corsHeaders,
});

// Y el cliente user (línea 25): cambiar SUPABASE_SERVICE_ROLE_KEY por SUPABASE_ANON_KEY:
const userClient = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);
```

**Despliegue:** después de editar, redeploy con `supabase functions deploy delete-account` (o desde el dashboard).

---

## Cambios opcionales (no parte del crítico, aplazables)

| ID | Archivo | Cambio | Severidad |
|---|---|---|---|
| HI-04 | `AppContext.tsx:341-346` | Sacar el upsert de presencia del `useEffect` con `location` en deps; usar effect separado con `[user, currentZoneId]` y heartbeat con setInterval | HIGH (UX bug) |
| HI-05 | `AppContext.tsx:147-161` | Añadir flag `aborted` y `clearWatch` en cleanup | HIGH (memory leak) |
| HI-06 | `AppContext.tsx:404-406` | Redondear `lat`/`lng` a 3 decimales en panic flow | HIGH (privacy) |
| ME-04 | `AlertDetailsPage.tsx:13-15` | Fallback fetch directo si la alerta no está en `activeAlerts` | MEDIUM (deep link 404) |
| ME-06 | `AppContext.tsx:74` etc. | Polyfill de `crypto.randomUUID` para WebViews antiguas | MEDIUM (Android compat) |

Estos no bloquean la migración SQL — pueden ir en releases siguientes. Pero idealmente todos antes del closed test público.

---

## Smoke tests post-deploy (a hacer en el iPhone simulator)

Tras aplicar cliente + migración:

- [ ] **Login** funciona y muestra perfil propio
- [ ] **Buscador de amigos** por friend_code devuelve resultados
- [ ] **Enviar solicitud** a un amigo funciona (RPC nueva)
- [ ] **Aceptar solicitud** funciona
- [ ] **Lista de mascotas propias** funciona
- [ ] **Página pública del QR** (cerrar sesión, abrir `/pet/<id>`) funciona y muestra contact_info SOLO si `is_lost`
- [ ] **Crear alerta de pánico** funciona; otros usuarios cercanos la ven
- [ ] **Chat de alerta** funciona; mensajes con foto funcionan
- [ ] **Crear zona de paseo** funciona en cuenta trial; segunda zona devuelve error correcto
- [ ] **Unirse a zona** funciona en trial; en cuenta `expired` devuelve error
- [ ] **Ver zona como no-miembro:** se ve el count, NO se ven las personas
- [ ] **Ver zona como miembro:** se ve presencia completa (con privacy filter de amigos client-side)
- [ ] **Eliminar cuenta** funciona y muestra el error correcto si falla

## Verificación adversaria (curl con anon key)

Confirmar que estos comandos devuelven `0 rows` o error:

```bash
ANON='<la VITE_SUPABASE_ANON_KEY>'
URL='https://kcisuedbzghoccgbshpa.supabase.co/rest/v1'

# 1. profiles - debería ser 0 rows con anon
curl -s "$URL/profiles?select=*" -H "apikey: $ANON" | jq 'length'

# 2. pets - debería ser 0 rows
curl -s "$URL/pets?select=*" -H "apikey: $ANON" | jq 'length'

# 3. zone_presence - debería ser 0 rows
curl -s "$URL/zone_presence?select=*" -H "apikey: $ANON" | jq 'length'

# 4. public_pets - debería funcionar y NO devolver contact_info para mascotas no perdidas
curl -s "$URL/public_pets?select=id,name,is_lost,contact_info&limit=5" -H "apikey: $ANON" | jq

# 5. nearby_push_subscribers RPC - debería devolver permission denied
curl -s "$URL/rpc/nearby_push_subscribers" -X POST -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"alert_lat":40.4,"alert_lng":-3.7}' | jq
```

Si todo eso responde como toca, la migración ha sido aplicada correctamente y la app está lista para closed test desde el ángulo de privacidad/seguridad.
