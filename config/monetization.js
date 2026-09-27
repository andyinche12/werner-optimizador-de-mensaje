// config/monetization.js
// Configuración de descripciones, placeholders, checklist monetización

import { env } from './env.js';

export const MONETIZATION_CONFIG = {
  channelName: env.CHANNEL_NAME,
  niche: env.NICHE,

  // Placeholders de afiliados (se reemplazan en descripciones)
  placeholders: {
    BROKER_LINK: env.AFFILIATE_BROKER,
    TEMPLATE_LINK: env.AFFILIATE_TEMPLATE,
    BOOK_LINK: env.AFFILIATE_BOOK,
    CHANNEL_LINK: 'https://youtube.com/@tucanal',
    INSTAGRAM_LINK: 'https://instagram.com/tucuenta',
    TIKTOK_LINK: 'https://tiktok.com/@tucuenta',
  },

  // Config por plataforma
  platforms: {
    youtube: {
      maxTitleChars: 60,
      maxDescChars: 5000,
      chapters: true,
      timestamps: true,
      hashtagsCount: 10,
      requiredSections: ['hook', 'summary', 'timestamps', 'links', 'hashtags', 'disclaimer'],
    },
    tiktok: {
      maxTitleChars: 100,
      maxDescChars: 2200,
      chapters: false,
      timestamps: false,
      hashtagsCount: 8,
      requiredSections: ['hook', 'cta', 'hashtags'],
    },
    shorts: {
      maxTitleChars: 100,
      maxDescChars: 5000,
      chapters: false,
      timestamps: false,
      hashtagsCount: 10,
      requiredSections: ['hook', 'cta', 'hashtags'],
    },
  },

  // Disclaimers por nicho
  disclaimers: {
    finanzas_personales: '⚠️ Contenido educativo, no asesoría financiera. Enlaces pueden ser de afiliados.',
    salud: '⚠️ Información educativa, no sustituye consejo médico profesional.',
    general: '⚠️ Contenido con fines educativos/entretenimiento. Verifica la información.',
    tecnologia: '⚠️ Opiniones personales. Haz tu propia investigación.',
  },

  // CTA templates
  ctaTemplates: {
    subscribe: 'Suscríbete para más contenido de {niche} 👉 {channel_link}',
    freebie: '¿Quieres mi {resource} gratis? Comenta "{keyword}" y te lo envío 📩',
    affiliate: 'Uso {tool} y me va genial. Pruébalo aquí: {affiliate_link}',
    engagement: '¿Qué opinas? Comenta {option_a} o {option_b} 👇',
    follow: 'Sígueme en {platform} para más: {platform_link}',
  },

  // Checklist de monetización (se muestra en UI)
  checklist: [
    { id: 'title_length', label: 'Título < 60 caracteres', platform: ['youtube'] },
    { id: 'hook_first_lines', label: 'Gancho en primeras 2 líneas', platform: ['youtube', 'tiktok', 'shorts'] },
    { id: 'cta_clear', label: 'CTA claro y accionable', platform: ['youtube', 'tiktok', 'shorts'] },
    { id: 'disclaimer_present', label: 'Disclaimer legal incluido', platform: ['youtube', 'tiktok', 'shorts'] },
    { id: 'affiliate_disclosed', label: 'Enlaces afiliados revelados', platform: ['youtube'] },
    { id: 'hashtags_relevant', label: 'Hashtags relevantes (3-10)', platform: ['youtube', 'tiktok', 'shorts'] },
    { id: 'timestamps_chapters', label: 'Timestamps/Capítulos (YouTube)', platform: ['youtube'] },
    { id: 'thumbnail_prompt', label: 'Prompts thumbnail generados', platform: ['youtube'] },
  ],

  // Hashtags base por nicho
  nicheHashtags: {
    finanzas_personales: ['finanzaspersonales', 'inversion', 'dinero', 'ahorro', 'libertadfinanciera', 'educacionfinanciera'],
    historias: ['historias', 'storytime', 'misterio', 'leyendas', 'crimenreal', 'storytelling'],
    motivacion: ['motivacion', 'estoicismo', 'disciplina', 'habitos', 'mentalidad', 'superacion'],
    tecnologia: ['tecnologia', 'ia', 'programacion', 'futuro', 'innovacion', 'tech'],
    general: ['viral', 'fyp', 'parati', 'aprendeentiktok', 'datointeresante'],
  },
};

export function getDisclaimer(niche) {
  return MONETIZATION_CONFIG.disclaimers[niche] || MONETIZATION_CONFIG.disclaimers.general;
}

export function getNicheHashtags(niche, count = 6) {
  const tags = MONETIZATION_CONFIG.nicheHashtags[niche] || MONETIZATION_CONFIG.nicheHashtags.general;
  return tags.slice(0, count).map(t => `#${t}`);
}

export function replacePlaceholders(text, customPlaceholders = {}) {
  const allPlaceholders = { ...MONETIZATION_CONFIG.placeholders, ...customPlaceholders };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => allPlaceholders[key] || match);
}

export default MONETIZATION_CONFIG;