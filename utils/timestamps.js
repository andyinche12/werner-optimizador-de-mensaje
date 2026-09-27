// utils/timestamps.js
// Generación de SRT, VTT y JSON con timestamps desde audio + texto

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Estima timestamps por palabras basándose en duración total y conteo de palabras
 * Para TTS sin forced alignment, es una aproximación razonable
 */
export function estimateTimestamps(script, totalDurationSeconds) {
  // Limpiar marcas para conteo real de palabras
  const cleanText = script
    .replace(/\[pausa:[^\]]+\]/g, ' ')
    .replace(/\[énfasis\]([^\[]+)\[\/énfasis\]/g, '$1')
    .replace(/\[tono:\w+\]([\s\S]*?)\[\/tono\]/g, '$1')
    .replace(/\[visual:[^\]]+\]/g, '')
    .trim();

  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  if (wordCount === 0) return [];

  const wordsPerSecond = wordCount / totalDurationSeconds;
  const msPerWord = 1000 / wordsPerSecond;

  const timestamps = [];
  let currentTime = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const start = currentTime;
    const end = currentTime + msPerWord;
    
    timestamps.push({
      word,
      start: Math.round(start),
      end: Math.round(end),
      index: i,
    });
    
    currentTime = end;
  }

  return timestamps;
}

/**
 * Genera contenido SRT a partir de escenas con timestamps estimados
 */
export function generateSRT(scenes, totalDuration) {
  let srt = '';
  let counter = 1;
  let currentTime = 0;

  for (const scene of scenes) {
    const words = scene.text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) continue;

    const sceneDuration = (words.length / scenes.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0)) * totalDuration;
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + sceneDuration);

    srt += `${counter}\n${startTime} --> ${endTime}\n${scene.text}\n\n`;
    counter++;
    currentTime += sceneDuration;
  }

  return srt.trim();
}

/**
 * Genera contenido VTT (WebVTT)
 */
export function generateVTT(scenes, totalDuration) {
  let vtt = 'WEBVTT\n\n';
  let currentTime = 0;

  for (const scene of scenes) {
    const words = scene.text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) continue;

    const sceneDuration = (words.length / scenes.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0)) * totalDuration;
    const startTime = formatVTTTime(currentTime);
    const endTime = formatVTTTime(currentTime + sceneDuration);

    vtt += `${startTime} --> ${endTime}\n${scene.text}\n\n`;
    currentTime += sceneDuration;
  }

  return vtt.trim();
}

/**
 * Genera JSON estructurado con timestamps por palabra y escena
 */
export function generateTimestampJSON(script, scenes, totalDuration, metadata = {}) {
  const wordTimestamps = estimateTimestamps(script, totalDuration);
  
  return {
    metadata: {
      totalDuration,
      wordCount: wordTimestamps.length,
      generatedAt: new Date().toISOString(),
      ...metadata,
    },
    words: wordTimestamps.map(w => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
    scenes: scenes.map((scene, idx) => {
      const sceneWords = scene.text.split(/\s+/).filter(w => w.length > 0);
      const startIdx = scenes.slice(0, idx).reduce((sum, s) => sum + s.text.split(/\s+/).filter(w => w.length > 0).length, 0);
      const endIdx = startIdx + sceneWords.length - 1;
      
      return {
        index: idx,
        text: scene.text,
        visual: scene.visual || null,
        tone: scene.tone || 'neutral',
        startWord: startIdx,
        endWord: endIdx,
        startTime: startIdx >= 0 && startIdx < wordTimestamps.length ? wordTimestamps[startIdx].start : 0,
        endTime: endIdx >= 0 && endIdx < wordTimestamps.length ? wordTimestamps[endIdx].end : totalDuration * 1000,
      };
    }),
  };
}

function formatSRTTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Obtiene duración real de un archivo de audio usando ffprobe
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export default { estimateTimestamps, generateSRT, generateVTT, generateTimestampJSON, getAudioDuration };