const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

async function enviarWhatsApp(numero, mensaje) {
  if (!PHONE_ID || !TOKEN || !numero) return;
  const cleaned = numero.replace(/[^0-9+]/g, "");
  const to = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: mensaje },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) console.error("[WhatsApp] Error:", data.error?.message || data);
    return data;
  } catch (err) {
    console.error("[WhatsApp] Fallo al enviar:", err.message);
  }
}

function formatMensaje(tipo, nombre, hora, minutosRetraso) {
  if (tipo === "retraso") {
    return `\u26a0\ufe0f ${nombre} marc\u00f3 las ${hora} con ${minutosRetraso} min de retraso`;
  }
  return `\u2705 ${nombre} marc\u00f3 las ${hora} a tiempo`;
}

function formatMensajeEmpleado(tipo, hora, minutosRetraso) {
  if (tipo === "retraso") {
    return `\u26a0\ufe0f Marcaste las ${hora} con ${minutosRetraso} min de retraso`;
  }
  return `\u2705 Marcaste las ${hora} a tiempo. \u00a1Buen d\u00eda!`;
}

module.exports = { enviarWhatsApp, formatMensaje, formatMensajeEmpleado };
