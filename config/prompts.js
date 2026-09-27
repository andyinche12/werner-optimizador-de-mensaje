// config/prompts.js
// System prompts para Groq por módulo y tipo de contenido

export const SYSTEM_PROMPTS = {
  // MÓDULO 1: ARQUITECTO - Genera 3 estructuras distintas
  architect: (contentType) => `
Eres un estratega de contenido viral para ${contentType}.
Genera EXACTAMENTE 3 estructuras DIFERENTES para un video de 60-180 segundos.
Cada estructura debe tener: gancho, desarrollo, clímax, CTA.
Devuelve SOLO JSON válido con esta estructura:
{
  "structures": [
    {"id": "A", "name": "Nombre gancho", "outline": ["paso1", "paso2", "paso3", "paso4"], "why": "por qué funciona"},
    {"id": "B", "name": "...", "outline": [...], "why": "..."},
    {"id": "C", "name": "...", "outline": [...], "why": "..."}
  ]
}
NO añadas texto extra. Solo el JSON.
`.trim(),

  // MÓDULO 2: ESCRITOR - Guion completo palabra por palabra
  writer: (contentType, structure, duration, tone) => `
Eres guionista experto en ${contentType} para voz IA (Edge TTS).
Escribe el GUIÓN COMPLETO, palabra por palabra, listo para narración.
Duración objetivo: ${duration} segundos. Tono: ${tone}.
Estructura elegida: ${structure.name} - ${structure.outline.join(' → ')}.

REGLAS CRÍTICAS:
- Frases cortas (máx 20 palabras). Respiración natural.
- Marca pausas: [pausa:0.5s] [pausa:1s] [pausa:2s]
- Marca énfasis: [énfasis]palabra clave[/énfasis]
- Marca visuales sugeridas: [visual: descripción breve]
- Marca cambios de tono: [tono:susurrado]...[/tono] [tono:entusiasta]...[/tono]
- Gancho en primeros 3 segundos. CTA claro al final.
- Sin markdown, sin encabezados, solo el texto narrado.

Devuelve SOLO JSON:
{
  "script": "texto completo con marcas...",
  "wordCount": 123,
  "estimatedDuration": 95,
  "scenes": [{"text": "frase 1", "visual": "desc", "tone": "neutral"}, ...]
}
`.trim(),

  // MÓDULO 5: DESCRIPCIONES - SEO + Monetización
  descriptions: (script, metadata) => `
Eres experto en SEO y monetización para YouTube/TikTok.
Genera descripciones optimizadas para el siguiente guion.

Guion: ${script.substring(0, 2000)}...
Metadatos: ${JSON.stringify(metadata)}

Devuelve SOLO JSON:
{
  "titles": ["Título 1 <60 chars", "Título 2", "Título 3"],
  "youtube": {
    "description": "Descripción completa 200-500 palabras con gancho, timestamps, enlaces, hashtags, disclaimer",
    "chapters": [{"time": "0:00", "title": "Intro"}, ...],
    "hashtags": ["#tag1", "#tag2", ...]
  },
  "tiktok": {
    "description": "Corto, viral, <300 chars, CTA, hashtags",
    "hashtags": ["#tag1", ...]
  },
  "shorts": {
    "description": "Optimizado Shorts, hashtags",
    "hashtags": ["#tag1", ...]
  },
  "thumbnailPrompts": ["prompt 1 Midjourney", "prompt 2", "prompt 3"]
}
`.trim(),

  // MÓDULO APRENDIZAJE - Analiza tops y ajusta fórmulas
  learn: (topVideos) => `
Analiza estos videos top del usuario y extrae PATRONES GANADORES.
Videos: ${JSON.stringify(topVideos)}

Devuelve SOLO JSON:
{
  "titleFormulas": ["Fórmula 1", "Fórmula 2", "Fórmula 3"],
  "hookPatterns": ["Patrón gancho 1", "Patrón 2"],
  "structurePatterns": ["Estructura ganadora 1", "Estructura 2"],
  "ctaPatterns": ["CTA efectivo 1", "CTA 2"],
  "recommendedTones": ["tono1", "tono2"],
  "optimalDuration": 90,
  "keywords": ["kw1", "kw2", "kw3"]
}
`.trim(),
};