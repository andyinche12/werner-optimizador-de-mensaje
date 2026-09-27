// services/edge-tts.js
// Wrapper Edge TTS usando node-edge-tts (librería CommonJS) con retry y fallback

import pkg from 'node-edge-tts';
const { EdgeTTS } = pkg;
import fs from 'fs';
import path from 'path';
import os from 'os';

import { TTS_LIMITS, EDGE_TTS_VOICES, TONE_TO_SSML } from '../config/tts.js';
import { buildSSML } from '../utils/ssml.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1s, 2s, 4s

// Voces de fallback en orden de preferencia
const FALLBACK_VOICES = [
  'es-ES-AlvaroNeural',
  'es-ES-ElviraNeural',
  'es-MX-DaliaNeural',
  'es-MX-JorgeNeural',
];

function getVoiceList() {
  return Object.entries(EDGE_TTS_VOICES).map(([id, info]) => ({ id, ...info }));
}

function validateVoice(voiceId) {
  return EDGE_TTS_VOICES[voiceId] ? voiceId : Object.keys(EDGE_TTS_VOICES)[0];
}

function splitText(text, maxChars = TTS_LIMITS.maxCharsPerRequest) {
  const chunks = [];
  let current = '';
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  
  return chunks;
}

/**
 * Sintetiza un chunk SSML con reintentos y fallback de voz
 */
async function synthesizeChunkWithRetry(ssml, voiceId, attempt = 1) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  
  const { EdgeTTS } = await import('node-edge-tts');
  
  return new Promise((resolve, reject) => {
    const tts = new EdgeTTS();
    tts.voice = voiceId;
    tts.rate = '+0%';
    tts.pitch = '+0Hz';
    tts.volume = '+0%';
    tts.lang = 'es-ES';
    tts.saveSubtitles = false;
    
    tts.ttsPromise(ssml, tempFile)
      .then(() => {
        const buffer = fs.readFileSync(tempFile);
        try { fs.unlinkSync(tempFile); } catch {}
        resolve(buffer);
      })
      .catch(err => {
        try { fs.unlinkSync(tempFile); } catch {}
        
        const isRateLimit = err.message?.includes('429') || err.message?.includes('rate limit');
        const isNetworkError = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('network');
        const isRetryable = isRateLimit || isNetworkError;
        
        console.error(`[EdgeTTS] Intento ${attempt} falló para voz ${voiceId}:`, err.message);
        
        // Reintentar con la misma voz
        if (attempt < MAX_RETRIES && isRetryable) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          console.log(`[EdgeTTS] Reintentando en ${delay}ms... (intento ${attempt + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            synthesizeChunkWithRetry(ssml, voiceId, attempt + 1).then(resolve).catch(reject);
          }, delay);
          return;
        }
        
        // Fallback a otra voz si no es el último intento o si es error de voz no disponible
        const voiceIndex = FALLBACK_VOICES.indexOf(voiceId);
        if (voiceIndex >= 0 && voiceIndex < FALLBACK_VOICES.length - 1) {
          const nextVoice = FALLBACK_VOICES[voiceIndex + 1];
          console.log(`[EdgeTTS] Fallback a voz: ${nextVoice}`);
          synthesizeChunkWithRetry(ssml, nextVoice, 1).then(resolve).catch(reject);
          return;
        }
        
        // No más reintentos ni fallbacks
        reject(err);
      });
  });
}

// Función principal: texto con marcas → audio buffer
export async function textToSpeech(script, voiceConfig) {
  const voiceId = validateVoice(voiceConfig.voiceId);
  const baseTone = voiceConfig.toneOverrides?.base || 'neutral';
  const toneConfig = TONE_TO_SSML[baseTone] || TONE_TO_SSML.neutral;
  
  const globalConfig = {
    rate: voiceConfig.rate || '+0%',
    pitch: voiceConfig.pitch || '+0Hz',
    volume: voiceConfig.volume || '+0%',
    ...toneConfig,
  };
  
  const chunks = splitText(script);
  
  if (chunks.length === 1) {
    const ssml = buildSSML(chunks[0], voiceId, globalConfig, voiceConfig.toneOverrides);
    return synthesizeChunkWithRetry(ssml, voiceId);
  }
  
  const buffers = [];
  for (const chunk of chunks) {
    const ssml = buildSSML(chunk, voiceId, globalConfig, voiceConfig.toneOverrides);
    const buffer = await synthesizeChunkWithRetry(ssml, voiceId);
    buffers.push(buffer);
  }
  
  return Buffer.concat(buffers);
}

// Preview de un párrafo (para UI)
export async function previewParagraph(text, voiceConfig) {
  const voiceId = validateVoice(voiceConfig.voiceId);
  const ssml = buildSSML(text, voiceId, { 
    rate: voiceConfig.rate, 
    pitch: voiceConfig.pitch, 
    volume: voiceConfig.volume 
  });
  return synthesizeChunkWithRetry(ssml, voiceId);
}

export { getVoiceList, validateVoice, splitText, TTS_LIMITS, EDGE_TTS_VOICES };
export default { textToSpeech, previewParagraph, getVoiceList, validateVoice };