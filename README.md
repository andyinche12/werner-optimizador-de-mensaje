# werner Audio Factory v2.0

Generador de audios narrados con IA para YouTube, TikTok y Reels.
**Flujo:** Idea → 3 Estructuras virales → Guion completo → Voz natural (Edge TTS) → MP3 normalizado (-14 LUFS) + Subtítulos + Descripciones SEO/Monetización → Publicar.

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | Node.js 18+ + Express + TypeScript-ready (JSDoc + Zod) |
| **IA Guiones** | Groq SDK → `openai/gpt-oss-120b` |
| **IA Voz** | Edge TTS (Microsoft) - Gratis, voces neuronales español nativo |
| **Audio** | ffmpeg (fluent-ffmpeg) → Normalización -14 LUFS (EBU R128) |
| **Frontend** | Vanilla JS + CSS Variables (PWA, offline-first) |
| **Storage** | IndexedDB (biblioteca local) + Filesystem temp (backend) |
| **Deploy** | Backend: Render (gratis) | Frontend: Vercel (gratis) |

---

## 📁 Estructura del Proyecto

```
werner-optimizador-de-mensaje/
├── server.js                 # Entry point Express
├── package.json
├── render.yaml               # Config deploy Render
├── vercel.json               # Config deploy Vercel
├── .env.example              # Variables de entorno
├── config/
│   ├── env.js                # Validación env (Zod)
│   ├── tts.js                # Voces Edge TTS + SSML mapping
│   ├── prompts.js            # System prompts por módulo
│   └── monetization.js       # Placeholders, disclaimers, hashtags
├── routes/
│   ├── script.js             # /api/script/architect, /write, /generate
│   ├── tts.js                # /api/tts, /preview, /voices
│   ├── generate.js           # /api/generate (pipeline completo)
│   ├── descriptions.js       # /api/descriptions (SEO + monetización)
│   ├── learn.js              # /api/learn (análisis videos top)
│   └── audio.js              # /api/audio/:id, /srt/:id, /json/:id, /script/:id
├── services/
│   ├── groq.js               # Llamadas a Groq
│   ├── edge-tts.js           # Wrapper Edge TTS (fetch + SSML)
│   └── storage.js            # Archivos temp + limpieza automática
├── utils/
│   ├── ssml.js               # Builder SSML desde marcas [pausa] [énfasis] [tono]
│   ├── loudness.js           # ffmpeg loudnorm -14 LUFS
│   ├── timestamps.js         # SRT, VTT, JSON timestamps
│   └── json.js               # Extract JSON robusto de respuestas LLM
├── shared/
│   └── schemas.js            # Esquemas Zod (validación + tipos)
└── public/
    ├── index.html            # PWA Shell
    ├── manifest.json
    ├── sw.js                 # Service Worker
    ├── styles/main.css       # Design system (dark/light)
    └── js/
        ├── app.js            # Lógica principal (Wizard 5 pasos)
        ├── state.js          # Estado reactivo + localStorage
        ├── api.js            # Cliente API con retry
        ├── voice.js          # Speech Recognition + Synthesis
        ├── library.js        # IndexedDB biblioteca
        ├── learn.js          # Módulo aprendizaje
        └── toast.js          # Notificaciones
```

---

## ⚙️ Variables de Entorno

Copiar `.env.example` a `.env` y completar:

```bash
# Obligatoria
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx

# Opcionales (tienen defaults)
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
TEMP_DIR=./temp
MAX_SCRIPT_LENGTH=50000
MAX_TTS_CHARS=5000
AUDIO_CLEANUP_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info

# Monetización (placeholders)
AFFILIATE_BROKER={{BROKER_LINK}}
AFFILIATE_TEMPLATE={{TEMPLATE_LINK}}
AFFILIATE_BOOK={{BOOK_LINK}}
CHANNEL_NAME=Mi Canal
NICHE=general
```

---

## 🛠️ Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env
cp .env.example .env
# Editar .env con tu GROQ_API_KEY

# 3. Ejecutar en modo dev (auto-reload)
npm run dev

# 4. Abrir http://localhost:3000
```

**Requisitos:**
- Node.js 18.17+
- ffmpeg instalado en el sistema (para normalización de audio)
  - Windows: `winget install ffmpeg` o descargar de ffmpeg.org
  - Mac: `brew install ffmpeg`
  - Linux: `apt install ffmpeg`

---

## 🌐 Deploy en Producción (Gratis)

### Backend → Render

1. Push a GitHub repo `werner-optimizador-de-mensaje`
2. En Render Dashboard → **New Web Service** → Conectar repo
3. Render detecta `render.yaml` automáticamente
4. En **Environment Variables** agregar:
   - `GROQ_API_KEY` = tu key de Groq (marcar como Secret)
   - `FRONTEND_URL` = `https://TU-PROYECTO.vercel.app`
5. Deploy → Obtienes URL: `https://werner-audio-factory-backend.onrender.com`

### Frontend → Vercel

1. En Vercel Dashboard → **Add New Project** → Importar mismo repo
2. **Root Directory**: `./` (raíz del repo)
3. **Framework Preset**: Vite (o Other)
4. **Build Command**: `npm run build` (o dejar vacío si no hay build step)
5. **Output Directory**: `dist` (o `public` si no usas Vite build)
6. En **Environment Variables**:
   - `VITE_API_URL` = `https://werner-audio-factory-backend.onrender.com`
7. Deploy → Obtienes URL: `https://werner-audio-factory.vercel.app`

### Actualizar CORS

En Render, edita `FRONTEND_URL` a tu URL real de Vercel.
En Vercel, el `vercel.json` ya tiene rewrite a `/api/*` → backend.

---

## 🎯 Flujo de Uso (Wizard 5 Pasos)

| Paso | Qué haces | Qué genera la IA |
|------|-----------|------------------|
| **1. Idea** | Escribes tema + eliges tipo/duración/tono | — |
| **2. Estructura** | Eliges 1 de 3 opciones virales | 3 estructuras con gancho/desarrollo/clímax/CTA |
| **3. Guion** | Editas texto completo con marcas | Guion palabra x palabra + escenas + visuales |
| **4. Voz** | Eliges voz, velocidad, haces previews | Preview por párrafos (Edge TTS) |
| **5. Exportar** | Descargas + Copias descripciones | MP3 -14 LUFS + SRT/VTT + JSON + Descripciones YouTube/TikTok/Shorts + Hashtags + Thumbnail prompts + Checklist |

---

## 🎙️ Voces Edge TTS Disponibles (Gratis)

| Voz | País | Género | Ideal para |
|-----|------|--------|------------|
| `es-ES-AlvaroNeural` | España | ♂ | General, profesional |
| `es-ES-ElviraNeural` | España | ♀ | Cercano, educativo |
| `es-MX-DaliaNeural` | México | ♀ | Lifestyle, historias |
| `es-MX-JorgeNeural` | México | ♂ | Noticias, tops |
| `es-AR-ElenaNeural` | Argentina | ♀ | Storytelling, íntimo |
| `es-AR-TomasNeural` | Argentina | ♂ | Dramático, misterio |
| `es-CO-SalomeNeural` | Colombia | ♀ | Motivación, energía |
| `es-CO-GonzaloNeural` | Colombia | ♂ | Finanzas, seriedad |
| `es-US-AlonsoNeural` | EE.UU. | ♂ | Tech, internacional |
| `es-US-PalomaNeural` | EE.UU. | ♀ | General, neutro |

---

## 📝 Marcas en Guion (SSML)

Escribe en el editor del Paso 3:

```
[pausa:0.5s]          → Pausa corta (respiración)
[pausa:1s]            → Pausa media (cambio tema)
[pausa:2s]            → Pausa larga (efecto dramático)
[énfasis]palabra[/énfasis]  → Énfasis fuerte
[tono:entusiasta]texto[/tono]  → Cambio de estilo (cheerful, serious, whispering, storytelling, friendly, sad, angry, fearful)
[visual: persona caminando] → Nota para editor (no se narra)
```

---

## 📋 Descripciones Generadas (Paso 5)

**Botones COPIAR directos:**
- 📋 Copiar YouTube (descripción completa + timestamps + hashtags + disclaimer)
- 📋 Copiar TikTok (viral + CTA + hashtags)
- 📋 Copiar Shorts (optimizado + hashtags)
- 📋 Copiar Hashtags (por plataforma)
- 📋 Copiar Thumbnail Prompts (listos para Midjourney/DALL-E)

**Checklist monetización automático:**
- ✅ Título < 60 chars
- ✅ Gancho en primeras 2 líneas
- ✅ CTA claro
- ✅ Disclaimer legal
- ✅ Enlaces afiliados revelados
- ✅ Hashtags relevantes (3-10)
- ✅ Timestamps/Capítulos (YouTube)
- ✅ Prompts thumbnail

---

## 🧠 Módulo Aprendizaje (Sidebar)

1. Pegas URLs de tus videos **top performers** (vistas, watch time, CTR)
2. Clic en **"Analizar y aprender patrones"**
3. La IA extrae:
   - Fórmulas de título ganadoras
   - Patrones de gancho
   - Estructuras virales
   - CTAs efectivos
   - Tonos recomendados
   - Duración óptima
   - Palabras clave
4. Clic en **"Aplicar a próximo proyecto"** → se usan automáticamente

---

## 🔧 Scripts Disponibles

```bash
npm start       # Producción
npm run dev     # Desarrollo con --watch
```

---

## 📦 Dependencias Principales

```json
{
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.19.2",
  "express-rate-limit": "^7.2.0",
  "fluent-ffmpeg": "^2.1.3",
  "groq-sdk": "^0.14.0",
  "json5": "^2.2.3",
  "node-fetch": "^3.3.2",
  "uuid": "^10.0.0",
  "zod": "^3.23.8"
}
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| `ffmpeg not found` | Instalar ffmpeg y agregar al PATH |
| `Edge TTS 403/429` | Esperar unos minutos; la API tiene rate limit suave |
| `Groq API error` | Verificar `GROQ_API_KEY` en .env / Render |
| `CORS error` | Verificar `FRONTEND_URL` en backend = URL exacta de Vercel |
| `Audio no reproduce` | Verificar que `/api/audio/:id` responde 200 (check logs Render) |
| `PWA no instala` | Servir en HTTPS (Vercel/Render lo dan gratis) + manifest.json válido |

---

## 📄 Licencia

MIT - Úsalo libremente para tus proyectos de contenido.

---

## 🙏 Créditos

- **Groq** - Inferencia ultrarrápida de LLMs open source
- **Microsoft Edge TTS** - Voces neuronales gratuitas de alta calidad
- **ffmpeg** - Procesamiento de audio profesional
- **Zod** - Validación de esquemas TypeScript-first

---

**Desarrollado por Werner con asistencia de Talia (IA)** 🤝