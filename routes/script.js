// routes/script.js
// Endpoints: POST /api/script/architect, POST /api/script/write, POST /api/script/generate
// Lógica de Groq centralizada en services/groq.js

import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS } from '../config/prompts.js';
import { extractJson } from '../utils/json.js';
import { IdeaInputSchema, ArchitectOutputSchema, StructureChoiceSchema, ScriptOutputSchema } from '../shared/schemas.js';
import { chatCompletion } from '../services/groq.js';

const router = express.Router();

async function generateStructures(idea, contentType) {
  const systemPrompt = SYSTEM_PROMPTS.architect(contentType);
  const userPrompt = `IDEA: ${idea}\nTIPO: ${contentType}`;
  const response = await chatCompletion(systemPrompt, userPrompt);
  return extractJson(response);
}

async function generateScript(idea, contentType, structure, duration, tone, customInstructions = '') {
  const systemPrompt = SYSTEM_PROMPTS.writer(contentType, structure, duration, tone);
  const userPrompt = `IDEA: ${idea}\nINSTRUCCIONES ADICIONALES: ${customInstructions || 'Ninguna'}`;
  const response = await chatCompletion(systemPrompt, userPrompt, { maxTokens: 8000 });
  return extractJson(response);
}

// Validación genérica
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

// POST /api/script/architect - Genera 3 estructuras
router.post('/architect', validate(IdeaInputSchema), async (req, res) => {
  try {
    const { idea, contentType } = req.validated;
    const result = await generateStructures(idea, contentType);
    const parsed = ArchitectOutputSchema.safeParse(result);
    
    if (!parsed.success) {
      console.error('Arquitect output inválido:', parsed.error);
      return res.status(500).json({ error: 'La IA devolvió estructura inválida' });
    }
    
    res.json(parsed.data);
  } catch (error) {
    console.error('Error en /architect:', error);
    res.status(500).json({ error: error.message || 'Error generando estructuras' });
  }
});

// POST /api/script/write - Genera guion completo
router.post('/write', validate(z.object({
  idea: IdeaInputSchema,
  structureChoice: StructureChoiceSchema,
  customInstructions: z.string().optional(),
})), async (req, res) => {
  try {
    const { idea, structureChoice, customInstructions } = req.validated;
    const { contentType, duration, tone } = idea;
    
    const result = await generateScript(
      idea.idea,
      contentType,
      structureChoice.structure,
      duration,
      tone,
      customInstructions
    );
    
    const parsed = ScriptOutputSchema.safeParse(result);
    if (!parsed.success) {
      console.error('Writer output inválido:', parsed.error);
      return res.status(500).json({ error: 'La IA devolvió guion inválido' });
    }
    
    res.json(parsed.data);
  } catch (error) {
    console.error('Error en /write:', error);
    res.status(500).json({ error: error.message || 'Error generando guion' });
  }
});

// POST /api/script/generate - Pipeline completo: architect + write (opcional)
router.post('/generate', validate(z.object({
  idea: IdeaInputSchema,
  structureChoice: StructureChoiceSchema.optional(),
  customInstructions: z.string().optional(),
})), async (req, res) => {
  try {
    const { idea, structureChoice, customInstructions } = req.validated;
    
    // 1. Generar estructuras si no hay choice
    let chosenStructure = structureChoice?.structure;
    
    if (!chosenStructure) {
      const archResult = await generateStructures(idea.idea, idea.contentType);
      const archParsed = ArchitectOutputSchema.safeParse(archResult);
      if (!archParsed.success) {
        return res.status(500).json({ error: 'Error generando estructuras' });
      }
      // Auto-elegir la primera
      chosenStructure = archParsed.data.structures[0];
    }
    
    // 2. Generar guion
    const scriptResult = await generateScript(
      idea.idea,
      idea.contentType,
      chosenStructure,
      idea.duration,
      idea.tone,
      customInstructions
    );
    
    const scriptParsed = ScriptOutputSchema.safeParse(scriptResult);
    if (!scriptParsed.success) {
      return res.status(500).json({ error: 'Error generando guion' });
    }
    
    res.json({
      structure: chosenStructure,
      script: scriptParsed.data,
    });
  } catch (error) {
    console.error('Error en /generate:', error);
    res.status(500).json({ error: error.message || 'Error en pipeline completo' });
  }
});

export default router;