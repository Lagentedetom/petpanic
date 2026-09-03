-- ============================================================================
-- Endurecimiento a partir del Security Advisor de Supabase (3-sep-2026).
--
-- Solo recoge lo que es arreglo real y de riesgo cero. Lo que el advisor marca
-- y aquí NO se toca, con su motivo, está al final del fichero.
-- ============================================================================

begin;

-- ── 1. Funciones de trigger invocables directamente ─────────────────────────
-- Las tres devuelven `trigger` y solo tienen sentido colgadas de su tabla; el
-- motor las ejecuta al margen de los permisos del rol que provoca el INSERT.
-- Tener EXECUTE concedido a anon/authenticated no habilita nada legítimo y sí
-- permite llamarlas a mano. `handle_new_user` es la más sensible: crea perfiles.
revoke execute on function public.handle_new_user()             from anon, authenticated;
revoke execute on function public.notify_new_alert()            from anon, authenticated;
revoke execute on function public.enforce_zone_creation_limit() from anon, authenticated;

-- ── 2. search_path fijo en las funciones que no lo tenían ───────────────────
-- Sin search_path fijo, quien pueda crear objetos en un esquema que preceda a
-- `public` puede secuestrar a qué tabla o función resuelve el cuerpo. Añadir
-- pg_temp al final es la forma canónica: impide que un objeto temporal del
-- llamante se cuele por delante.
alter function public.notify_new_alert()            set search_path = public, pg_temp;
alter function public.enforce_zone_no_overlap()     set search_path = public, pg_temp;
alter function public.enforce_zone_creation_limit() set search_path = public, pg_temp;
alter function public.has_active_social(uuid)       set search_path = public, pg_temp;
alter function public.is_social_active(uuid)        set search_path = public, pg_temp;

commit;

-- ============================================================================
-- LO QUE EL ADVISOR MARCA Y NO SE TOCA
-- ============================================================================
--
-- ERROR · security_definer_view en public_pets y public_profiles
--   No es un descuido: es una decisión tomada el 6-may-2026 y documentada en
--   20260506000001_public_profiles_definer_fix.sql. Con security_invoker=true
--   las vistas heredaban la RLS de las tablas y devolvían 0 filas, lo que
--   rompía el flujo de QR público y la búsqueda por código de amigo.
--   El trade-off anotado entonces —"la enumeración de friend_code es posible,
--   pero send_friend_request exige cuenta Social de pago"— se ha verificado
--   hoy y SIGUE SIENDO CIERTO: el gate is_social_active() está en su sitio.
--   La condición de revisión que se dejó escrita era "cuando la base de
--   usuarios pase del test cerrado", y el test cerrado no ha llegado a ocurrir.
--   Verificado hoy con la clave anon: se listan las 3 mascotas y los 4
--   perfiles con su friend_code completo. Con 4 usuarios de la casa es
--   inocuo; con usuarios reales es una fuga de datos personales en masa.
--   ⇒ REVISAR ANTES DE ABRIR EL REGISTRO A NADIE DE FUERA, no antes.
--      El arreglo, cuando toque, está esbozado abajo.
--
-- ERROR · rls_disabled_in_public en spatial_ref_sys
--   Tabla de PostGIS, no nuestra. Ya aceptado como falso positivo el 2-jun-2026.
--
-- WARN · extension_in_public para postgis y pg_net
--   Mover una extensión de esquema en una base viva rompe cada referencia no
--   cualificada que exista. El beneficio es cosmético. No compensa.
--
-- WARN · st_estimatedextent (×3)
--   Funciones de PostGIS, mismo caso que spatial_ref_sys.
--
-- INFO · rls_enabled_no_policy en protector_subscribers
--   RLS activa y sin políticas = nadie entra salvo service_role. Es
--   exactamente lo que se quiere: la tabla solo se toca por las RPC
--   subscribe_protectora / confirm / unsubscribe. Correcto tal cual.
--
-- ============================================================================
-- ESBOZO DEL ARREGLO DE LAS VISTAS (para el día que se abra el registro)
-- ============================================================================
-- 1. Quitar friend_code de public_profiles. Es el único campo realmente
--    sensible de los cuatro: es la credencial que identifica a una persona
--    para el flujo de amistad.
-- 2. El cliente ya no lo necesita para enviar la solicitud: send_friend_request
--    resuelve el código por dentro (where friend_code = upper(p_friend_code)).
--    Hay que quitar la búsqueda previa de AppContext.tsx:662, que hoy hace
--    .eq('friend_code', code) contra la vista, y llamar directamente a la RPC.
-- 3. Para pintar "Código: XXX" en las tarjetas de FriendsPage hace falta una
--    RPC nueva que devuelva el friend_code SOLO de quienes ya son amigos
--    aceptados del llamante.
-- 4. public_pets: sustituir el SELECT abierto por una RPC que reciba el id de
--    la mascota (el que lleva el QR) y devuelva esa ficha y solo esa. Hoy
--    `select * from public_pets` devuelve el censo entero.
