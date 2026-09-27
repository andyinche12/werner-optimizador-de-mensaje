// routes/tts.js
// Endpoints: POST /api/tts, POST /api/tts/preview
// Con ffmpeg local para normalización -14 LUFS, fade y duración real

import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { VoiceConfigSchema, TTSRequestSchema } from '../shared/schemas.js';
import { textToSpeech, previewParagraph, getVoiceList } from '../services/edge-tts.js';
import { normalizeLoudness, applyFade, getAudioDuration } from '../utils/loudness.js';
import { generateSRT, generateVTT, generateTimestampJSON } from '../utils/timestamps.js';
import { saveAudio, saveSRT, saveTimestampJSON, saveScript } from '../services/storage.js';

const router = express.Router();

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

// GET /api/tts/voices - Lista voces disponibles
router.get('/voices', (req, res) => {
  res.json({ voices: getVoiceList() });
});

// POST /api/tts/preview - Preview de un párrafo (rápido, sin guardar)
router.post('/preview', validate(z.object({
  text: z.string().min(1).max(5000),
  voiceConfig: VoiceConfigSchema,
})), async (req, res) => {
  try {
    const { text, voiceConfig } = req.validated;
    const buffer = await previewParagraph(text, voiceConfig);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Accept-Ranges': 'bytes',
    });
    res.send(buffer);
  } catch (error) {
    console.error('Error en /tts/preview:', error);
    res.status(500).json({ error: error.message || 'Error generando preview' });
  }
});

// POST /api/tts - Genera audio completo + SRT + JSON + normalización -14 LUFS + fade
router.post('/', validate(TTSRequestSchema), async (req, res) => {
  try {
    const { script, voiceConfig, splitChunks } = req.validated;
    
    // 1. Generar audio directamente desde Edge TTS (ya es MP3)
    const audioBuffer = await textToSpeech(script, voiceConfig);
    
    // 2. Guardar audio en archivo temporal para procesamiento con ffmpeg
    const tempId = `temp_${Date.now()}`;
    const tempDir = path.resolve('./temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const tempPath = path.join(tempDir, `${tempId}.mp3`);
    const normalizedPath = path.join(tempDir, `${tempId}_norm.mp3`);
    const finalPath = path.join(tempDir, `${tempId}_final.mp3`);
    
    console.log('[TTS] tempPath:', tempPath);
    console.log('[TTS] normalizedPath:', normalizedPath);
    console.log('[TTS] finalPath:', finalPath);
    
    // Escribir buffer a archivo temporal
    fs.writeFileSync(tempPath, audioBuffer);
    console.log('[TTS] Archivo temporal escrito:', tempPath, 'size:', audioBuffer.length);
    
    // 2. Normalizar loudness a -14 LUFS
    console.log('[TTS] Iniciando normalizeLoudness...');
    await normalizeLoudness(tempPath, normalizedPath);
    console.log('[TTS] normalizeLoudness completado');
    
    // 3. Aplicar fade in/out suave
    console.log('[TTS] Iniciando applyFade...');
    await applyFade(normalizedPath, finalPath, 0.3, 0.5);
    console.log('[TTS] applyFade completado');
    
    // 3. Leer archivo final procesado
    const finalBuffer = fs.readFileSync(finalPath);
    console.log('[TTS] Archivo final leído, size:', finalBuffer.length);
    
    // 4. Obtener duración real con ffprobe
    const duration = await getAudioDuration(finalPath);
    console.log('[TTS] Duración real:', duration);
    
    // 4. Generar SRT, VTT, JSON timestamps
    let scenes = [];
    try {
      const parsed = JSON.parse(script);
      if (parsed.scenes) scenes = parsed.scenes;
    } catch {
      scenes = [{ text: script, visual: null, tone: 'neutral' }];
    }
    
    const srt = generateSRT(scenes, duration);
    const vtt = generateVTT(scenes, duration);
    const timestampJSON = generateTimestampJSON(script, scenes, duration, {
      voice: voiceConfig.voiceId,
      tone: voiceConfig.toneOverrides?.base || 'neutral',
    });
    
    // 5. Guardar todo permanentemente
    const audioMeta = await saveAudio(finalBuffer, { duration });
    saveSRT(srt, audioMeta.id);
    saveTimestampJSON(timestampJSON, audioMeta.id);
    saveScript(script, audioMeta.id);
    
    // 6. Limpiar temporales
    [tempPath, normalizedPath, finalPath].forEach(p => {
      try { fs.unlinkSync(p); } catch {}
    });
    
    // 7. Responder con URLs
    res.json({
      id: audioMeta.id,
      audioUrl: audioMeta.url,
      srtUrl: `/api/srt/${audioMeta.id}`,
      vttUrl: `/api/vtt/${audioMeta.id}`,
      jsonUrl: `/api/json/${audioMeta.id}`,
      txtUrl: `/api/script/${audioMeta.id}`,
      duration: Math.round(duration),
      size: audioMeta.size,
      metadata: {
        voice: voiceConfig.voiceId,
        wordCount: script.split(/\s+/).filter(w => w.length > 0).length,
        note: 'Audio normalizado -14 LUFS con fade (ffmpeg local)',
      },
    });
  } catch (error) {
    console.error('Error en /tts:', error);
    res.status(500).json({ error: error.message || 'Error generando audio' });
  }
});

export default router;