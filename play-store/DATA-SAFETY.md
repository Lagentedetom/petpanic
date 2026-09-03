# Seguridad de los datos (Data Safety) — borrador para Play Console

> Play Console → Política → Seguridad de los datos. Esto es un BORRADOR basado en lo que
> hace la app hoy. ⚠️ Verifica cada punto antes de enviarlo: declarar de menos puede tumbar
> la revisión.

## Resumen
| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos de usuario? | **Sí, recopila** |
| ¿Se cifran en tránsito? | **Sí** (HTTPS/TLS; backend Supabase) |
| ¿El usuario puede pedir que se borren? | **Sí** (borrado de cuenta en la app — edge function `delete-account`) |
| ¿Hay forma de solicitar borrado? | Sí, desde Perfil + email hola@petpanic.es |

## Datos que se RECOPILAN

| Tipo de dato | ¿Se recopila? | ¿Se comparte?* | Propósito | ¿Obligatorio? |
|---|---|---|---|---|
| **Dirección de email** | Sí | No | Gestión de la cuenta, inicio de sesión | Obligatorio |
| **Nombre** (perfil) | Sí | No | Funcionalidad de la app | Opcional |
| **Ubicación precisa** | Sí | Sí (a otros usuarios en el radio, al lanzar un aviso) | Funcionalidad principal: alertas geolocalizadas y zonas de paseo | Obligatorio para lanzar avisos |
| **Fotos** (de la mascota) | Sí | Sí (visibles en el aviso) | Contenido del usuario; identificar a la mascota | Opcional |
| **Otros datos de la mascota** (nombre, raza, notas) | Sí | Sí (en el aviso) | Funcionalidad de la app | Opcional |
| **Interacciones in-app / actividad** (amigos, zonas, alertas) | Sí | No | Funcionalidad y conexión entre usuarios | Opcional |

\* "Compartir" en el sentido de Google = transferir a terceros. Aquí la ubicación/foto se
muestran a **otros usuarios de la app** como parte de la función de búsqueda. Supabase actúa
como **encargado del tratamiento** (proveedor de infraestructura), no como tercero al que
"vendemos" datos. **Confirma con Google cómo clasificar esto**; lo más seguro es marcar
ubicación y fotos como "compartidas con otros usuarios" para la función de alertas.

## Prácticas de seguridad
- Cifrado en tránsito: **Sí** (TLS).
- Datos alojados en la UE (Supabase, eu-west-2 / Irlanda).
- El usuario puede **eliminar su cuenta y datos** desde la app.

## Notas
- Si en el futuro se activa el **push nativo** (FCM, pendiente `google-services.json`), añadir
  identificadores de dispositivo / push token como dato recopilado para "Mensajes y notificaciones".
- No se usa publicidad ni analítica de terceros que recopile datos personales (verificar antes de enviar).
