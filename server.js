if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM = `Eres amaIA, la asistente de WhatsApp de Vektor MKT, una agencia de marketing digital en España.

PERSONALIDAD:
- Cercana, cálida, natural. Como si fuera una persona del equipo respondiendo por WhatsApp.
- Frases cortas y directas. Máximo 3-4 frases por respuesta.
- Usa 1 emoji ocasionalmente, nunca más de 2.
- Tutea siempre. Español natural, sin formalismos.
- Nunca digas que eres una IA o un bot a menos que te lo pregunten directamente.

SERVICIOS Y PRECIOS DE VEKTOR MKT:
- Gestión de redes sociales (Instagram, Facebook, TikTok, LinkedIn): desde 350€/mes
- SEO y posicionamiento en Google: desde 450€/mes
- Campañas Meta Ads y Google Ads: desde 300€/mes + inversión publicitaria
- Branding e identidad visual (logo, manual de marca): desde 800€
- Diseño web profesional: desde 1.200€

REGLAS:
- Si preguntan por precios, da rangos orientativos y ofrece propuesta personalizada.
- Si quieren agendar, pide nombre y email y propón: Lunes 10h, Martes 16h o Miércoles 11h.
- Si quieren hablar con una persona real, diles que conectas con el equipo ahora mismo.
- Nunca uses listas con guiones ni bullets. Solo párrafos cortos y naturales.
- Cuando el usuario confirme sus datos para contacto humano, incluye al final exactamente: [HANDOFF:nombre=NOMBRE,email=EMAIL]
- Cuando el usuario confirme sus datos para reserva, incluye al final exactamente: [RESERVA:nombre=NOMBRE,email=EMAIL,dia=DIA]`;

async function sendEmail(type, data, messages) {
  const isHandoff = type === 'handoff';
  const subject = isHandoff
    ? `🔔 amaIA: ${data.nombre} quiere hablar con una persona`
    : `📅 amaIA: ${data.nombre} quiere reservar una reunión`;

  const html = `
    <h2>${isHandoff ? '🔔 Nueva solicitud de contacto' : '📅 Nueva reserva de reunión'}</h2>
    <table style="border-collapse:collapse;width:100%;max-width:500px">
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Nombre</b></td><td style="padding:8px;border:1px solid #ddd">${data.nombre}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Email</b></td><td style="padding:8px;border:1px solid #ddd">${data.email}</td></tr>
      ${data.dia ? `<tr><td style="padding:8px;border:1px solid #ddd"><b>Día preferido</b></td><td style="padding:8px;border:1px solid #ddd">${data.dia}</td></tr>` : ''}
    </table>
    <h3>Conversación:</h3>
    <div style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px">
      ${messages.map(m => `<p><b>${m.role === 'user' ? '👤 Cliente' : '🤖 amaIA'}:</b> ${m.content}</p>`).join('')}
    </div>
    <p style="color:#aaa;font-size:12px">Enviado por amaIA · Vektor MKT</p>
  `;

  try {
    await resend.emails.send({
      from: 'amaIA <onboarding@resend.dev>',
      to: 'mktvektor@gmail.com',
      subject,
      html
    });
    console.log('Email enviado:', type);
  } catch(e) {
    console.error('Error email:', e.message);
  }
}


app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY || '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';
  
  console.log('API KEY presente:', apiKey ? 'SI - longitud:' + apiKey.length : 'NO');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM,
        messages: messages
      })
    });

    const data = await response.json();
    console.log('Respuesta API:', JSON.stringify(data).slice(0, 200));
    

    let reply = data.content?.[0]?.text || 'Un momento, enseguida te respondo 🙏';

    // Detectar handoff y enviar email
    const handoffMatch = reply.match(/\[HANDOFF:nombre=([^,]+),email=([^\]]+)\]/);
    if (handoffMatch) {
      reply = reply.replace(handoffMatch[0], '').trim();
      await sendEmail('handoff', { nombre: handoffMatch[1], email: handoffMatch[2] }, messages);
    }

    // Detectar reserva y enviar email
    const reservaMatch = reply.match(/\[RESERVA:nombre=([^,]+),email=([^,]+),dia=([^\]]+)\]/);
    if (reservaMatch) {
      reply = reply.replace(reservaMatch[0], '').trim();
      await sendEmail('reserva', { nombre: reservaMatch[1], email: reservaMatch[2], dia: reservaMatch[3] }, messages);
    }

    res.json({ reply });



  } catch (error) {
    console.error('Error fetch:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`amaIA corriendo en puerto ${PORT}`));