# PetPanic — Stripe setup runbook

Pasos para activar el cobro de PetPanic Social. Hay que hacer **todo este setup en stripe.com antes de poder desplegar las edge functions**, porque las funciones leen los Price IDs y la webhook secret de variables de entorno.

Tiempo estimado: **45-60 minutos** la primera vez.

> [!info] Entidad: La Gente de Tom S.L. (LGDT)
> Tras el análisis del 2026-05-06 (ver [[Autónomo vs SL — PetPanic SaaS]]),
> Stripe se abre **como persona jurídica con CIF de LGDT**. La SL ya existe,
> ya tiene gestoría + Quipu, y la tributación al 19% IS sobre microempresa
> es mejor que el IRPF marginal del autónomo. Apple Developer y Google Play
> también van bajo LGDT con D-U-N-S, así toda la cadena (cobros + stores +
> facturas) queda coherente.
>
> **PRE-REQUISITO**: que tu gestor de LGDT haya añadido **IAE 845 + CNAE 5829**
> vía modelo 036 antes de emitir la primera factura de Stripe. 5 min de
> llamada al gestor + 1-2 días para que se aplique.

---

## 1. Crear la cuenta de Stripe como LGDT (10 min)

1. Ir a [stripe.com](https://stripe.com) → "Start now"
2. Email (uno corporativo de LGDT, no el personal — facilita gestión futura) + contraseña
3. País: **España**
4. Tipo de negocio: **Limited liability company** / **Sociedad de responsabilidad limitada** (la SL)
5. **CIF de LGDT** + razón social "La Gente de Tom S.L." + dirección fiscal LGDT + teléfono
6. **IBAN de la cuenta bancaria de LGDT** — Stripe deposita los cobros aquí cada 2-7 días
7. Modelo de negocio que pide Stripe: **"Software / SaaS subscription"** o "Computer software / Digital products"
8. Stripe te dará acceso al dashboard en **modo test** (sk_test_...) — todas las pruebas iniciales se hacen en test

> [!warning] Verificación de identidad (KYC)
> Stripe te pedirá documentación: escrituras de constitución de LGDT, NIF de socios/administradores, modelo 036 actualizado (con el IAE 845 ya añadido — por eso es prerrequisito), DNI del administrador. Tarda 1-3 días laborables. Mientras se verifica, puedes operar en modo test sin restricciones.

> [!info] Test vs Live
> El dashboard tiene un toggle arriba a la izquierda: "Test mode" / "Live mode". Test no cobra dinero real. Cuando todo el flujo funcione end-to-end en test, activas Live mode (puede pedirte verificación adicional de identidad).

---

## 2. Crear el producto + 2 prices (5 min)

Stripe dashboard → **Products** → **Add product**

- **Name:** `PetPanic Social`
- **Description:** `Capa social de PetPanic: zonas de paseo, presencia en tiempo real, mensajería entre amigos.`
- **Tax behavior:** `Inclusive` (el precio mostrado YA incluye IVA — más limpio para el usuario español)
- **Image:** (opcional) sube un png 512x512 con el logo

**Pricing block 1 — Mensual**
- Type: `Recurring`
- Amount: `4.99 EUR`
- Billing period: `Monthly`
- Price description (interno): `monthly`

**Pricing block 2 — Anual** (Add another price)
- Type: `Recurring`
- Amount: `39.99 EUR`
- Billing period: `Yearly`
- Price description (interno): `annual`

Guardar. Anota los **Price IDs** que aparecen después (algo como `price_1QXxxxxxx`):
- `STRIPE_PRICE_MONTHLY` = price_xxxxx (el de €4.99/mes)
- `STRIPE_PRICE_ANNUAL` = price_xxxxx (el de €39.99/año)

---

## 3. Habilitar Stripe Tax para IVA español automático (5 min)

Stripe dashboard → **Settings** → **Tax** (en "Billing")

1. Activar **Stripe Tax**
2. Registrarse para España (Stripe pide el NIF de tu negocio)
3. Tax behavior por defecto: `Tax-inclusive`
4. Origen de facturación: España

> [!important] OSS para clientes UE fuera de España
> Si vendes a particulares de Francia, Italia, etc., a partir de €10.000/año
> en B2C UE tienes que registrarte en el régimen **OSS** (One-Stop Shop) en
> la AEAT (modelo 369). Stripe Tax te calcula y desglosa el IVA por país,
> pero TÚ tienes que hacer la declaración trimestral. Hasta esa cifra, todo
> con IVA español 21%. Detalles en `[[Autónomo vs SL — PetPanic SaaS]]`.

---

## 4. Configurar el Customer Portal (3 min)

Stripe dashboard → **Settings** → **Billing** → **Customer portal**

Habilitar:
- ✅ **Customers can update payment method**
- ✅ **Customers can cancel subscriptions** → al final del periodo (no inmediato)
- ✅ **Customers can switch between prices** → permitir cambiar entre `monthly` ↔ `annual` (selecciona los 2 prices del producto PetPanic Social)
- ✅ **Customers can update billing address** (necesario para Stripe Tax)
- ✅ **Customers can view invoice history**

Guardar.

---

## 5. Configurar el webhook endpoint (5 min)

Necesitas la URL del edge function ya desplegado. Si aún no se ha desplegado, despliégalo primero (siguiente sección) y vuelve aquí.

URL del webhook: `https://kcisuedbzghoccgbshpa.supabase.co/functions/v1/stripe-webhook`

Stripe dashboard → **Developers** → **Webhooks** → **Add endpoint**

- **Endpoint URL:** la URL de arriba
- **Events to send** (selecciona estos 5):
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Guardar

Anota el **Signing secret** que aparece (`whsec_xxxxx`). Esto es `STRIPE_WEBHOOK_SECRET`.

---

## 6. Anotar las API keys (1 min)

Stripe dashboard → **Developers** → **API keys**

Anota dos cosas:
- **Publishable key** `pk_test_...` o `pk_live_...` — *no la usamos directamente en este proyecto* (Stripe Checkout es server-side), pero tenla a mano
- **Secret key** `sk_test_...` o `sk_live_...` — esto es `STRIPE_SECRET_KEY`

> [!danger] Nunca commitees la secret key
> `sk_live_...` da acceso a TODO en tu cuenta de Stripe (cobrar, hacer refunds, ver clientes). Igual que el PAT de Supabase: vive solo como variable de entorno en las edge functions, NUNCA en `.env.local`, NUNCA en git, NUNCA en Obsidian.

---

## 7. Instalar las variables de entorno en Supabase (2 min)

Desde MCP de Claude (Claude lo puede hacer):
```
mcp__supabase__... (TBD: hay tool para edge function secrets)
```

O manualmente con Supabase CLI:
```bash
cd "/Users/nicotomic/Dropbox/LA GENTE DE TOM/000-LA GENTE DE TOM/2026/PETPANIC 2.0/petpanic"
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
supabase secrets set STRIPE_PRICE_MONTHLY=price_xxxxx
supabase secrets set STRIPE_PRICE_ANNUAL=price_xxxxx
supabase secrets set APP_URL=https://app.petpanic.es
```

(Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ya las tienen las edge functions por defecto.)

O via dashboard de Supabase:
- Project → Settings → Edge Functions → Manage secrets → Add secret

---

## 8. Aplicar la migración SQL + desplegar las 3 edge functions

Cuando Stripe esté listo (pasos 1-7), Claude despliega:

1. Migración: `20260506000002_stripe_columns.sql` (añade columnas + cambia trial a 15 días)
2. Edge function `stripe-checkout` (con `verify_jwt: true`)
3. Edge function `stripe-customer-portal` (con `verify_jwt: true`)
4. Edge function `stripe-webhook` (**con `verify_jwt: false`** — Stripe no manda JWT)
5. Build + deploy del cliente React (PlanPage nueva)

---

## 9. Test end-to-end en modo test (10 min)

Con todo desplegado y en **Test mode** de Stripe:

1. Abre `app.petpanic.es` con un usuario de prueba
2. Ve a `/plan`
3. Elige Anual o Mensual
4. Click "Activar PetPanic Social"
5. Stripe Checkout abre (en español)
6. Tarjeta de test: `4242 4242 4242 4242`, CVC `123`, fecha futura cualquiera, código postal cualquiera
7. Completar pago
8. Vuelves a `/plan?stripe=success`
9. Toast verde "¡Suscripción activada!"
10. Stripe webhook llega → `subscription_status` flipea a `'active'`
11. La página muestra "PetPanic Social anual activo" + botón "Gestionar suscripción"
12. Click "Gestionar" → portal de Stripe abre → puedes cambiar plan, cancelar, ver factura

**Verificaciones SQL** (con MCP de Supabase):
```sql
SELECT id, email, subscription_status, subscription_interval, stripe_customer_id, stripe_subscription_id, current_period_end
FROM profiles WHERE id = '<tu user uuid>';
```

Debe mostrar `subscription_status='active'`, `subscription_interval='year'` (si elegiste anual), un `stripe_subscription_id` válido y `current_period_end` ~1 año en el futuro.

Otro test: en Stripe dashboard → Subscriptions → cancela la suscripción del usuario → vuelve a la app → debe pasar a `expired`.

---

## 10. Pasar de Test a Live (cuando todo funcione)

1. Stripe dashboard → toggle a **Live mode**
2. Repetir pasos 2-6 EN LIVE (los productos / prices / webhooks de test NO se copian a live)
3. Anotar las nuevas keys (sk_live_..., whsec_... live, price_... live)
4. Actualizar las secrets de Supabase con los valores de Live
5. **Re-test end-to-end con tarjeta real** (puedes cobrarte a ti mismo €0.50 con un cupón "100% off" para no gastar dinero)

---

## Coste de Stripe

- **Comisión por transacción** (España, tarjetas EU): 1.5% + €0.25
- **Stripe Tax**: 0.5% adicional sobre el monto cobrado
- **Refunds**: gratis (no devuelve la comisión, pero no cobra extra)
- **Customer Portal**: gratis
- **Subscriptions billing**: gratis (forma parte de la comisión por transacción)

Para una suscripción anual de €39.99:
- Stripe se queda: 39.99 × 0.02 + 0.25 = **€1.05**
- Stripe Tax (si aplica): 39.99 × 0.005 = **€0.20**
- IVA al 21% que tú remitas a Hacienda: 39.99 × 0.21 / 1.21 = **€6.94** (porque el precio es tax-inclusive)
- **Te quedas en mano** ~€31.80 por suscripción anual

---

## Integración con Quipu (futuro, opcional)

Si en el futuro decides emitir facturas formales españolas a clientes que las pidan, tienes la API key de Quipu en `[[PetPanic - Credenciales y secrets]]`. La idea sería: webhook de Stripe `invoice.payment_succeeded` → llamar a Quipu API `/invoices` con los datos del cliente y emitir factura PDF formal. No es bloqueante para lanzamiento — Stripe genera receipts automáticos que sirven legalmente.

---

## Checklist resumen

- [ ] **Gestor de LGDT añadió IAE 845 + CNAE 5829 via modelo 036** (prerrequisito)
- [ ] Cuenta Stripe creada como LGDT (CIF + IBAN LGDT) y verificada
- [ ] Producto "PetPanic Social" + price mensual + price anual
- [ ] Stripe Tax habilitado para España
- [ ] Customer Portal configurado (cancel, switch plan, invoices)
- [ ] Webhook endpoint creado con los 5 eventos
- [ ] Anotadas: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`
- [ ] Variables instaladas en Supabase secrets
- [ ] Migración SQL aplicada
- [ ] 3 edge functions desplegadas
- [ ] Cliente React redesplegado
- [ ] Test end-to-end en Test mode pasa
- [ ] Listo para Live mode cuando hagas closed test
