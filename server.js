if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const resend = new Resend(process.env.RESEND_API_KEY);

// Google Calendar setup
let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n');
if(privateKey.startsWith('"')) privateKey = privateKey.slice(1);
if(privateKey.endsWith('"')) privateKey = privateKey.slice(0,-1);

const serviceAuth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  ['https://www.googleapis.com/auth/calendar']
);
const calendar = google.calendar({ version: 'v3', auth: serviceAuth });

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
- Si quieren agendar una reunión, pídeles nombre, email, teléfono y día preferido.
- Si quieren hablar con una persona real, pídeles nombre, email y teléfono primero.
- Nunca uses listas con guiones ni bullets. Solo párrafos cortos y naturales.
- Cuando el usuario confirme sus datos para contacto humano, incluye al final exactamente: [HANDOFF:nombre=NOMBRE,email=EMAIL,telefono=TELEFONO]
- Cuando el usuario confirme sus datos para reserva, incluye al final exactamente: [RESERVA:nombre=NOMBRE,email=EMAIL,telefono=TELEFONO,dia=DIA]`;

// Obtener horas disponibles de Google Calendar
async function getAvailableSlots() {
  const slots = [
    { day: 'Lunes', hour: 10, label: 'Lunes 10:00h' },
    { day: 'Lunes', hour: 12, label: 'Lunes 12:00h' },
    { day: 'Martes', hour: 10, label: 'Martes 10:00h' },
    { day: 'Martes', hour: 16, label: 'Martes 16:00h' },
    { day: 'Miércoles', hour: 11, label: 'Miércoles 11:00h' },
    { day: 'Miércoles', hour: 16, label: 'Miércoles 16:00h' },
    { day: 'Jueves', hour: 10, label: 'Jueves 10:00h' },
    { day: 'Viernes', hour: 11, label: 'Viernes 11:00h' },
  ];

console.log('Service account email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'OK' : 'NO');
console.log('Private key:', process.env.GOOGLE_PRIVATE_KEY ? 'OK longitud:'+process.env.GOOGLE_PRIVATE_KEY.length : 'NO');

  try {
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
    nextMonday.setHours(0, 0, 0, 0);
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    nextFriday.setHours(23, 59, 59, 0);

    const events = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: nextMonday.toISOString(),
      timeMax: nextFriday.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const busyTimes = (events.data.items || []).map(e => ({
      start: new Date(e.start.dateTime || e.start.date),
      end: new Date(e.end.dateTime || e.end.date)
    }));

    const available = slots.filter(slot => {
      const slotDate = new Date(nextMonday);
      const daysMap = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4 };
      slotDate.setDate(nextMonday.getDate() + daysMap[slot.day]);
      slotDate.setHours(slot.hour, 0, 0, 0);
      const slotEnd = new Date(slotDate);
      slotEnd.setHours(slot.hour + 1);

      return !busyTimes.some(busy => slotDate < busy.end && slotEnd > busy.start);
    });

    return available.map(s => s.label);
  } catch(e) {
    console.error('Error calendario:', e.message);
    return slots.map(s => s.label);
  }
}

// Crear evento en Google Calendar
async function createCalendarEvent(nombre, email, telefono, dia) {
  try {
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
    nextMonday.setHours(0, 0, 0, 0);

    const daysMap = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4 };
    const hourMatch = dia.match(/(\d+):?(\d*)/);
    const hour = hourMatch ? parseInt(hourMatch[1]) : 10;
    const dayName = Object.keys(daysMap).find(d => dia.includes(d)) || 'Lunes';

    const eventDate = new Date(nextMonday);
    eventDate.setDate(nextMonday.getDate() + daysMap[dayName]);
    eventDate.setHours(hour, 0, 0, 0);
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(hour + 1);

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      resource: {
        summary: `Reunión Vektor MKT — ${nombre}`,
        description: `Cliente: ${nombre}\nEmail: ${email}\nTeléfono: ${telefono}`,
        start: { dateTime: eventDate.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: eventEnd.toISOString(), timeZone: 'Europe/Madrid' },
        attendees: [{ email }],
      }
    });
    console.log('Evento creado en Google Calendar');
  } catch(e) {
    console.error('Error creando evento:', e.message);
  }
}

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
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Teléfono</b></td><td style="padding:8px;border:1px solid #ddd">${data.telefono}</td></tr>
      ${data.dia ? `<tr><td style="padding:8px;border:1px solid #ddd"><b>Día</b></td><td style="padding:8px;border:1px solid #ddd">${data.dia}</td></tr>` : ''}
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
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Inyectar disponibilidad si el usuario pregunta por reunión
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  let systemWithSlots = SYSTEM;
  if (lastMsg.match(/reun|agenda|cita|disponib|horario|cuando|día/i)) {
    const slots = await getAvailableSlots();
    systemWithSlots = SYSTEM + `\n\nDISPONIBILIDAD REAL ESTA SEMANA: ${slots.join(', ')}. Ofrece solo estos horarios.`;
  }

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
        max_tokens: 300,
        system: systemWithSlots,
        messages: messages
      })
    });

    const data = await response.json();
    let reply = data.content?.[0]?.text || 'Un momento, enseguida te respondo 🙏';

    // Detectar handoff
    const handoffMatch = reply.match(/\[HANDOFF:nombre=([^,]+),email=([^,]+),telefono=([^\]]+)\]/);
    if (handoffMatch) {
      reply = reply.replace(handoffMatch[0], '').trim();
      await sendEmail('handoff', { nombre: handoffMatch[1], email: handoffMatch[2], telefono: handoffMatch[3] }, messages);
    }

    // Detectar reserva
    const reservaMatch = reply.match(/\[RESERVA:nombre=([^,]+),email=([^,]+),telefono=([^,]+),dia=([^\]]+)\]/);
    if (reservaMatch) {
      reply = reply.replace(reservaMatch[0], '').trim();
      const reservaData = { nombre: reservaMatch[1], email: reservaMatch[2], telefono: reservaMatch[3], dia: reservaMatch[4] };
      await createCalendarEvent(reservaData.nombre, reservaData.email, reservaData.telefono, reservaData.dia);
      await sendEmail('reserva', reservaData, messages);
    }

    res.json({ reply });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Contact form endpoint ──────────────────────
app.post('/contact', async (req, res) => {
  const { name, email, service, message } = req.body;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'amaIA <onboarding@resend.dev>',
        to: 'mktvektor@gmail.com',
        subject: `Nuevo contacto web: ${name}`,
        html: `
          <h2>Nuevo mensaje desde vektormkt.es</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Servicio:</strong> ${service || 'No especificado'}</p>
          <p><strong>Mensaje:</strong><br>${message}</p>
        `
      })
    });

    if (response.ok) {
      res.json({ ok: true });
    } else {
      const err = await response.json();
      console.error('Resend error:', err);
      res.status(500).json({ ok: false, error: err });
    }
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`amaIA corriendo en puerto ${PORT}`));