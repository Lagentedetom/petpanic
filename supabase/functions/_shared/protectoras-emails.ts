// PetPanic — Email templates for the protectoras flow
//
// Inline HTML + plain-text fallback. Kept here (not in a CMS) because these
// are transactional, identity-bearing emails — version-controlled, no
// runtime template editing, no surprise content changes.
//
// All emails:
//  - From: "PetPanic <alertas@petpanic.es>" (configurable via RESEND_FROM)
//  - Branded with the orange/black palette + minimal HTML (max compatibility)
//  - Always include a 1-click unsubscribe link with token (RFC 8058 friendly)
//
// Resend API: https://resend.com/docs/api-reference/emails/send-email

const BRAND_ORANGE = "#ea580c";
const BRAND_DARK = "#1c1917";
const APP_URL = Deno.env.get("APP_URL") || "https://app.petpanic.es";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "PetPanic <alertas@petpanic.es>";

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function resendSend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  // List-Unsubscribe header so Gmail/Apple Mail show the unsubscribe button
  // (RFC 8058). Required to keep deliverability healthy on bulk sends.
  unsubscribeUrl?: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    return { ok: false, error: `resend ${resp.status}: ${body}` };
  }
  const data = await resp.json();
  return { ok: true, id: data.id };
}

function shell(title: string, body: string, unsubscribeUrl?: string): string {
  const unsubFooter = unsubscribeUrl
    ? `<p style="margin:24px 0 0 0;font-size:11px;color:#a8a29e;line-height:1.5">
         No quieres recibir más estos avisos?
         <a href="${unsubscribeUrl}" style="color:#a8a29e;text-decoration:underline">Darte de baja</a>
         con un solo click.
       </p>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${BRAND_DARK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:24px 16px">
      <table role="presentation" width="100%" style="max-width:560px" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:8px 0 24px 0">
          <span style="font-weight:800;font-size:20px;color:${BRAND_DARK}">Pet</span><span style="font-weight:800;font-size:20px;color:${BRAND_ORANGE}">Panic</span>
        </td></tr>
        <tr><td style="background:white;border-radius:16px;padding:32px;border:1px solid #e7e5e4">
          ${body}
          ${unsubFooter}
        </td></tr>
        <tr><td style="padding:16px 8px;font-size:11px;color:#a8a29e;text-align:center">
          PetPanic · La Gente de Tom · <a href="${APP_URL}" style="color:#a8a29e">app.petpanic.es</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ------------- Doble opt-in: confirm subscription -------------

export function confirmEmail(opts: {
  nombre: string;
  cp: string;
  city: string;
  province: string;
  confirmUrl: string;
  radioKm: number;
}): { subject: string; html: string; text: string } {
  const subject = `Confirma tu suscripción a las alertas de PetPanic`;
  const html = shell(
    subject,
    `
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:800">Hola ${escape(opts.nombre)},</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55">
      Habéis solicitado recibir alertas de PetPanic para mascotas perdidas y encontradas
      en vuestra zona. Para activarlo, solo hay que confirmar este email:
    </p>
    <p style="margin:24px 0;text-align:center">
      <a href="${opts.confirmUrl}" style="display:inline-block;background:${BRAND_ORANGE};color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px">
        Confirmar suscripción
      </a>
    </p>
    <p style="margin:24px 0 0 0;font-size:13px;color:#57534e;line-height:1.55">
      <strong>Zona configurada:</strong> ${escape(opts.cp)} (${escape(opts.city)}, ${escape(opts.province)}) — radio ${opts.radioKm} km.<br>
      <strong>¿Qué recibiréis?</strong> Un email cada vez que se pierda o se encuentre una mascota dentro de vuestra zona. Nada más. Sin spam, sin contraseñas, sin app que instalar.<br>
      <strong>¿Por qué este email?</strong> Alguien ha rellenado el formulario de alta de protectoras con esta dirección. Si no fuisteis vosotros, ignorad este email — sin confirmar no se enviará nada más.
    </p>
    `
  );
  const text = `Hola ${opts.nombre},

Habéis solicitado recibir alertas de PetPanic para mascotas perdidas y encontradas en vuestra zona.

Para activar la suscripción, confirma este email:
${opts.confirmUrl}

Zona configurada: ${opts.cp} (${opts.city}, ${opts.province}), radio ${opts.radioKm} km.

Si no fuisteis vosotros, ignorad este email — sin confirmar no se enviará nada más.

— PetPanic`;
  return { subject, html, text };
}

// ------------- Alerta perdida -------------

export function lostAlertEmail(opts: {
  nombrePet: string;
  petPhoto?: string;
  petBreed?: string;
  petColor?: string;
  petTraits?: string;
  ownerContact: string;
  city: string;
  alertUrl: string;
  reportUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `🚨 Perro perdido cerca de vosotros: ${opts.nombrePet}`;
  const photoBlock = opts.petPhoto
    ? `<p style="margin:0 0 16px 0;text-align:center">
         <img src="${opts.petPhoto}" alt="${escape(opts.nombrePet)}" style="max-width:100%;border-radius:12px;border:1px solid #e7e5e4">
       </p>`
    : "";
  const detailRows = [
    opts.petBreed && `<strong>Raza:</strong> ${escape(opts.petBreed)}`,
    opts.petColor && `<strong>Color:</strong> ${escape(opts.petColor)}`,
    opts.petTraits && `<strong>Señas:</strong> ${escape(opts.petTraits)}`,
  ].filter(Boolean).join("<br>");
  const html = shell(
    subject,
    `
    <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#dc2626">¡Emergencia cercana!</p>
    <h1 style="font-size:24px;margin:0 0 16px 0;font-weight:800">Se ha perdido ${escape(opts.nombrePet)}</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55">
      Una mascota se ha reportado como perdida cerca de <strong>${escape(opts.city)}</strong>. Vuestra protectora puede ayudar a encontrarla — sois el equipo más cualificado de la zona.
    </p>
    ${photoBlock}
    ${detailRows ? `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#44403c">${detailRows}</p>` : ""}
    <p style="margin:0 0 8px 0;font-size:14px"><strong>Contacto del dueño:</strong> ${escape(opts.ownerContact)}</p>
    <p style="margin:24px 0;text-align:center">
      <a href="${opts.alertUrl}" style="display:inline-block;background:${BRAND_ORANGE};color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;margin:4px">
        Ver detalles + mapa
      </a>
      <a href="${opts.reportUrl}" style="display:inline-block;background:white;color:${BRAND_DARK};text-decoration:none;padding:13px 28px;border-radius:12px;font-weight:700;font-size:15px;border:2px solid ${BRAND_DARK};margin:4px">
        Tengo info / lo he visto
      </a>
    </p>
    <p style="margin:24px 0 0 0;font-size:13px;color:#57534e;line-height:1.55">
      Si tenéis a un animal en vuestras instalaciones que coincida con esta descripción, podéis avisar al dueño directamente con su contacto, o usar el botón <em>Tengo info</em> para enviar un mensaje desde aquí (sin daros de alta en ningún sitio).
    </p>
    `,
    opts.unsubscribeUrl
  );
  const text = `🚨 Perro perdido cerca de vosotros: ${opts.nombrePet}

Se ha reportado una mascota perdida cerca de ${opts.city}.

${opts.petBreed ? `Raza: ${opts.petBreed}\n` : ""}${opts.petColor ? `Color: ${opts.petColor}\n` : ""}${opts.petTraits ? `Señas: ${opts.petTraits}\n` : ""}
Contacto del dueño: ${opts.ownerContact}

Ver detalles + mapa: ${opts.alertUrl}
Tengo info / lo he visto: ${opts.reportUrl}

— PetPanic
Darse de baja: ${opts.unsubscribeUrl}`;
  return { subject, html, text };
}

// ------------- Alerta resuelta -------------

export function resolvedAlertEmail(opts: {
  nombrePet: string;
  alertUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ ${opts.nombrePet} ha sido encontrado`;
  const html = shell(
    subject,
    `
    <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#16a34a">Caso cerrado</p>
    <h1 style="font-size:22px;margin:0 0 16px 0;font-weight:800">${escape(opts.nombrePet)} ha sido encontrado</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55">
      Gracias por estar atentos. La alerta de <strong>${escape(opts.nombrePet)}</strong> se ha cerrado — la familia ha recuperado a su mascota.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#57534e;line-height:1.55">
      Podéis descartar este caso. Si lo teníais marcado en vuestro tablón, ya podéis quitarlo. Gracias por el trabajo que hacéis todos los días.
    </p>
    <p style="margin:24px 0 0 0;text-align:center">
      <a href="${opts.alertUrl}" style="font-size:13px;color:#78716c;text-decoration:underline">Ver alerta original</a>
    </p>
    `,
    opts.unsubscribeUrl
  );
  const text = `✅ ${opts.nombrePet} ha sido encontrado

La alerta se ha cerrado — la familia ha recuperado a su mascota. Gracias por estar atentos.

Ver alerta original: ${opts.alertUrl}

— PetPanic
Darse de baja: ${opts.unsubscribeUrl}`;
  return { subject, html, text };
}
