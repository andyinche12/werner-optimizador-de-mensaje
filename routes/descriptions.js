// routes/descriptions.js
// Endpoint: POST /api/descriptions - Genera descripciones SEO + monetización para un guion
// Lógica de Groq centralizada en services/groq.js

import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS } from '../config/prompts.js';
import { extractJson } from '../utils/json.js';
import { DescriptionsRequestSchema, DescriptionsOutputSchema } from '../shared/schemas.js';
import { getDisclaimer, getNicheHashtags, replacePlaceholders } from '../config/monetization.js';
import { saveDescriptions } from '../services/storage.js';
import { chatCompletion } from '../services/groq.js';

const router = express.Router();

async function generateDescriptionsGroq(script, metadata) {
  const systemPrompt = SYSTEM_PROMPTS.descriptions(script, metadata);
  const userPrompt = `METADATOS: ${JSON.stringify(metadata)}`;
  const response = await chatCompletion(systemPrompt, userPrompt, { maxTokens: 6000 });
  return extractJson(response);
}

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: result.error.flatten() });
    }
    req.validated = result.data;
    next();
  };
}

// POST /api/descriptions - Genera descripciones completas
router.post('/', validate(DescriptionsRequestSchema), async (req, res) => {
  try {
    const { script, metadata } = req.validated;
    
    // Generar con IA
    const result = await generateDescriptionsGroq(script, metadata);
    const parsed = DescriptionsOutputSchema.safeParse(result);
    
    if (!parsed.success) {
      console.error('Descriptions output inválido:', parsed.error);
      // Intentar reconstruir con defaults
      const defaultDescriptions = {
        titles: [
          "Título generado automáticamente",
          "Título alternativo",
          "Título con gancho"
        ],
        youtube: {
          description: "Descripción generada automáticamente.",
          chapters: [],
          hashtags: ["#educativo", "#aprende"]
        },
        tiktok: {
          description: "Descripción corta viral.",
          hashtags: ["#viral", "#aprende"]
        },
        shorts: {
          description: "Descripción para Shorts.",
          hashtags: ["#shorts", "#aprende"]
        },
        thumbnailPrompts: [
          "Prompt 1 para thumbnail",
          "Prompt 2 para thumbnail", 
          "Prompt 3 para thumbnail"
        ],
        checklist: []
      };
      return res.json(defaultDescriptions);
    }
    
    let descriptions = parsed.data;
    
    // ===== POST-PROCESADO: Reemplazar placeholders + añadir disclaimer + checklist =====
    const niche = metadata.niche || metadata.contentType;
    const disclaimer = getDisclaimer(niche);
    const nicheTags = getNicheHashtags(niche, 6);
    
    // Reemplazar placeholders en descripciones
    const customPlaceholders = {
      CHANNEL_NAME: metadata.title || 'Mi Canal',
      NICHE: niche,
    };
    
    descriptions.youtube.description = replacePlaceholders(descriptions.youtube.description, customPlaceholders);
    descriptions.tiktok.description = replacePlaceholders(descriptions.tiktok.description, customPlaceholders);
    descriptions.shorts.description = replacePlaceholders(descriptions.shorts.description, customPlaceholders);
    
    // Añadir disclaimer si no está
    if (!descriptions.youtube.description.includes('⚠️')) {
      descriptions.youtube.description += `\n\n${disclaimer}`;
    }
    
    // Asegurar que chapters existe
    if (!descriptions.youtube.chapters) {
      descriptions.youtube.chapters = [];
    }
    
    // Mezclar hashtags: IA + nicho
    const mergeHashtags = (aiTags, nicheTags, max) => {
      const seen = new Set();
      const merged = [...aiTags, ...nicheTags.map(t => t.startsWith('#') ? t : `#${t}`)]
        .filter(tag => {
          const norm = tag.toLowerCase();
          if (seen.has(norm)) return false;
          seen.add(norm);
          return true;
        });
      return merged.slice(0, max);
    };
    
    descriptions.youtube.hashtags = mergeHashtags(descriptions.youtube.hashtags || [], nicheTags, 10);
    descriptions.tiktok.hashtags = mergeHashtags(descriptions.tiktok.hashtags || [], nicheTags, 8);
    descriptions.shorts.hashtags = mergeHashtags(descriptions.shorts.hashtags || [], nicheTags, 10);
    
    // Asegurar thumbnailPrompts
    if (!descriptions.thumbnailPrompts || descriptions.thumbnailPrompts.length < 3) {
      descriptions.thumbnailPrompts = [
        "Thumbnail prompt 1",
        "Thumbnail prompt 2",
        "Thumbnail prompt 3"
      ];
    }
    
    // Generar checklist de monetización
    const { MONETIZATION_CONFIG } = await import('../config/monetization.js');
    const checklist = MONETIZATION_CONFIG.checklist.map(item => ({
      ...item,
      passed: checkItem(item.id, descriptions, metadata),
    }));
    descriptions.checklist = checklist;
    
    // Guardar si hay ID (opcional)
    if (req.body.audioId) {
      saveDescriptions(descriptions, req.body.audioId);
    }
    
    res.json(descriptions);
  } catch (error) {
    console.error('Error en /descriptions:', error);
    res.status(500).json({ error: error.message || 'Error generando descripciones' });
  }
});

// Checks para checklist
function checkItem(id, descriptions, metadata) {
  switch (id) {
    case 'title_length':
      return descriptions.titles.some(t => t.length <= 60);
    case 'hook_first_lines':
      const ytDesc = descriptions.youtube.description;
      return ytDesc.length > 50 && (ytDesc.includes('?') || ytDesc.includes('!') || ytDesc.split('.')[0].length < 100);
    case 'cta_clear':
      return /suscr[ií]bete|comenta|link|bio|gratis|descarga/i.test(descriptions.youtube.description) ||
             /comenta|s[ií]gueme|link/i.test(descriptions.tiktok.description);
    case 'disclaimer_present':
      return /⚠️|aviso|disclaimer|educativo|no asesor/i.test(descriptions.youtube.description);
    case 'affiliate_disclosed':
      return /afiliado|affiliate|enlace.*gana/i.test(descriptions.youtube.description);
    case 'hashtags_relevant':
      return descriptions.youtube.hashtags.length >= 3 && descriptions.youtube.hashtags.length <= 10;
    case 'timestamps_chapters':
      return descriptions.youtube.chapters.length > 1;
    case 'thumbnail_prompt':
      return descriptions.thumbnailPrompts.length === 3;
    default:
      return false;
  }
}

export default router;