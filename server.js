if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
    
    if (data.content && data.content[0]) {
      res.json({ reply: data.content[0].text });
    } else {
      res.json({ reply: 'Un momento, enseguida te respondo 🙏' });
    }
  } catch (error) {
    console.error('Error fetch:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`amaIA corriendo en puerto ${PORT}`));