if (process.env.NODE_ENV !== 'production') require('dotenv').config();
console.log('API KEY cargada:', process.env.ANTHROPIC_API_KEY ? 'SI' : 'NO');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const client = new Anthropic();

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
- Nunca uses listas con guiones ni bullets. Solo párrafos cortos y naturales.`;

app.post('/chat', async (req, res) => {
  const { messages } = req.body;
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM,
      messages: messages
    });
    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`amaIA corriendo en puerto ${PORT}`));