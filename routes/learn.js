// routes/learn.js
// Endpoint: POST /api/learn - Aprende de tus videos top y ajusta fórmulas
// Lógica de Groq centralizada en services/groq.js

import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS } from '../config/prompts.js';
import { extractJson } from '../utils/json.js';
import { LearnRequestSchema, LearnOutputSchema } from '../shared/schemas.js';
import { chatCompletion } from '../services/groq.js';

const router = express.Router();

async function analyzeTopVideosGroq(videos) {
  const systemPrompt = SYSTEM_PROMPTS.learn(videos);
  const userPrompt = `DATOS: ${JSON.stringify(videos)}`;
  const response = await chatCompletion(systemPrompt, userPrompt, { maxTokens: 4000 });
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

// POST /api/learn - Analiza videos top y extrae patrones
router.post('/', validate(LearnRequestSchema), async (req, res) => {
  try {
    const { videos } = req.validated;
    
    // Validaciones adicionales
    if (videos.length < 1) {
      return res.status(400).json({ error: 'Se requiere al menos 1 video' });
    }
    
    // Filtrar solo videos con métricas mínimas
    const validVideos = videos.filter(v => 
      v.views > 100 && v.watchTime > 10
    );
    
    if (validVideos.length === 0) {
      return res.status(400).json({ error: 'Ningún video tiene métricas suficientes (mín 100 vistas, 10s watch time)' });
    }
    
    // Llamar a IA
    const result = await analyzeTopVideosGroq(validVideos);
    const parsed = LearnOutputSchema.safeParse(result);
    
    if (!parsed.success) {
      console.error('Learn output inválido:', parsed.error);
      return res.status(500).json({ error: 'La IA devolvió análisis inválido' });
    }
    
    // Guardar en config para uso futuro (en memoria o archivo)
    // Por ahora solo devolvemos
    res.json({
      success: true,
      analyzedCount: validVideos.length,
      patterns: parsed.data,
      message: `Analizados ${validVideos.length} videos top. Patrones listos para aplicar.`,
    });
  } catch (error) {
    console.error('Error en /learn:', error);
    res.status(500).json({ error: error.message || 'Error analizando videos' });
  }
});

// GET /api/learn/patterns - Obtiene patrones guardados (si se implementa persistencia)
router.get('/patterns', (req, res) => {
  // TODO: leer de archivo/config
  res.json({ patterns: null, message: 'Persistencia no implementada aún' });
});

export default router;