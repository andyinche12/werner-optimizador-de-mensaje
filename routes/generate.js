// routes/generate.js
// Endpoint: POST /api/generate - Pipeline completo: Idea → Estructura → Guion → Audio
// Descripciones se generan aparte via /api/descriptions
// Lógica de Groq centralizada en services/groq.js

import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS } from '../config/prompts.js';
import { extractJson } from '../utils/json.js';
import { GenerateRequestSchema } from '../shared/schemas.js';
import { textToSpeech } from '../services/edge-tts.js';
import { generateSRT, generateVTT, generateTimestampJSON } from '../utils/timestamps.js';
import { saveAudio, saveSRT, saveTimestampJSON, saveScript } from '../services/storage.js';
import { normalizeLoudness, applyFade, getAudioDuration } from '../utils/loudness.js';
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

// POST /api/generate - Pipeline: Idea → Estructura → Guion → Audio
router.post('/', validate(GenerateRequestSchema), async (req, res) => {
  try {
    const { idea, structureChoice, script: existingScript, voiceConfig, skipTTS } = req.validated;
    
    let chosenStructure = structureChoice?.structure;
    let scriptData = existingScript;
    
    // ===== PASO 1: ARQUITECTO (si no hay estructura elegida) =====
    if (!chosenStructure) {
      const archResult = await generateStructures(idea.idea, idea.contentType);
      const { ArchitectOutputSchema } = await import('../shared/schemas.js');
      const archParsed = ArchitectOutputSchema.safeParse(archResult);
      if (!archParsed.success) {
        return res.status(500).json({ error: 'Error generando estructuras' });
      }
      chosenStructure = archParsed.data.structures[0];
    }
    
    // ===== PASO 2: ESCRITOR (si no hay guion existente) =====
    if (!scriptData) {
      const scriptResult = await generateScript(
        idea.idea,
        idea.contentType,
        chosenStructure,
        idea.duration,
        idea.tone,
        idea.customInstructions
      );
      const { ScriptOutputSchema } = await import('../shared/schemas.js');
      const scriptParsed = ScriptOutputSchema.safeParse(scriptResult);
      if (!scriptParsed.success) {
        return res.status(500).json({ error: 'Error generando guion' });
      }
      scriptData = scriptParsed.data;
    }
    
    // ===== PASO 3: TTS + AUDIO (si no skipTTS) =====
    let audioResult = null;
    if (!skipTTS) {
      const vc = voiceConfig || { voiceId: 'es-ES-AlvaroNeural', rate: '+0%', pitch: '+0Hz', volume: '+0%' };
      
      // Generar audio directamente desde Edge TTS
      const audioBuffer = await textToSpeech(scriptData.script, vc);
      
      // Procesar con ffmpeg: normalizar -14 LUFS + fade + duración real (igual que /api/tts)
      const tempId = `temp_${Date.now()}`;
      const tempDir = path.resolve('./temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
      const tempPath = path.join(tempDir, `${tempId}.mp3`);
      const normalizedPath = path.join(tempDir, `${tempId}_norm.mp3`);
      const finalPath = path.join(tempDir, `${tempId}_final.mp3`);
      
      console.log('[Generate] tempPath:', tempPath);
      console.log('[Generate] normalizedPath:', normalizedPath);
      console.log('[Generate] finalPath:', finalPath);
      
      // Escribir buffer a archivo temporal
      fs.writeFileSync(tempPath, audioBuffer);
      console.log('[Generate] Archivo temporal escrito:', tempPath, 'size:', audioBuffer.length);
      
      // Normalizar loudness a -14 LUFS
      console.log('[Generate] Iniciando normalizeLoudness...');
      await normalizeLoudness(tempPath, normalizedPath);
      console.log('[Generate] normalizeLoudness completado');
      
      // Aplicar fade in/out suave
      console.log('[Generate] Iniciando applyFade...');
      await applyFade(normalizedPath, finalPath, 0.3, 0.5);
      console.log('[Generate] applyFade completado');
      
      // Leer archivo final procesado
      const finalBuffer = fs.readFileSync(finalPath);
      console.log('[Generate] Archivo final leído, size:', finalBuffer.length);
      
      // Obtener duración real con ffprobe
      const duration = await getAudioDuration(finalPath);
      console.log('[Generate] Duración real:', duration);
      
      // Generar subtítulos y timestamps con duración REAL
      const srt = generateSRT(scriptData.scenes, duration);
      const vtt = generateVTT(scriptData.scenes, duration);
      const timestampJSON = generateTimestampJSON(scriptData.script, scriptData.scenes, duration, {
        voice: vc.voiceId,
        tone: idea.tone,
        contentType: idea.contentType,
      });
      
      // Guardar todo permanentemente
      audioResult = await saveAudio(finalBuffer, { duration });
      saveSRT(srt, audioResult.id);
      saveTimestampJSON(timestampJSON, audioResult.id);
      saveScript(scriptData.script, audioResult.id);
      
      // Limpiar temporales
      [tempPath, normalizedPath, finalPath].forEach(p => {
        try { fs.unlinkSync(p); } catch {}
      });
    }
    
    // ===== RESPUESTA FINAL =====
    // Descripciones se generan aparte via POST /api/descriptions
    res.json({
      success: true,
      structure: chosenStructure,
      script: scriptData,
      audio: audioResult ? {
        id: audioResult.id,
        audioUrl: audioResult.url,
        srtUrl: `/api/srt/${audioResult.id}`,
        vttUrl: `/api/vtt/${audioResult.id}`,
        jsonUrl: `/api/json/${audioResult.id}`,
        txtUrl: `/api/script/${audioResult.id}`,
        duration: Math.round(audioResult.duration || 0),
        size: audioResult.size,
      } : null,
      descriptions: null, // Se obtiene via POST /api/descriptions
      checklist: null,
      nextStep: audioResult ? 'Genera descripciones con POST /api/descriptions usando el script y audioId' : null,
    });
    
  } catch (error) {
    console.error('Error en /generate:', error);
    res.status(500).json({ error: error.message || 'Error en pipeline completo' });
  }
});

export default router;