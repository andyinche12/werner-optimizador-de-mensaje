// services/storage.js
// Gestión de archivos temporales: guardado, limpieza automática, URLs de descarga

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const TEMP_DIR = path.resolve(env.TEMP_DIR);
const AUDIO_DIR = path.join(TEMP_DIR, 'audio');
const SCRIPT_DIR = path.join(TEMP_DIR, 'scripts');
const DESC_DIR = path.join(TEMP_DIR, 'descriptions');

// Asegurar directorios
[AUDIO_DIR, SCRIPT_DIR, DESC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Guarda buffer de audio como MP3 y devuelve metadata + URL relativa
 */
export async function saveAudio(buffer, metadata = {}) {
  const id = uuidv4();
  const filename = `${id}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);
  
  fs.writeFileSync(filepath, buffer);
  
  const stats = fs.statSync(filepath);
  const url = `/api/audio/${id}`;
  
  return {
    id,
    filename,
    filepath,
    url,
    size: stats.size,
    createdAt: new Date().toISOString(),
    ...metadata,
  };
}

/**
 * Guarda guion (texto) como archivo
 */
export function saveScript(script, id) {
  const filename = `${id}.txt`;
  const filepath = path.join(SCRIPT_DIR, filename);
  fs.writeFileSync(filepath, script, 'utf-8');
  return { filename, filepath, url: `/api/script/${id}` };
}

/**
 * Guarda SRT
 */
export function saveSRT(srtContent, id) {
  const filename = `${id}.srt`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, srtContent, 'utf-8');
  return { filename, filepath, url: `/api/srt/${id}` };
}

/**
 * Guarda JSON timestamps
 */
export function saveTimestampJSON(jsonContent, id) {
  const filename = `${id}.json`;
  const filepath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(jsonContent, null, 2), 'utf-8');
  return { filename, filepath, url: `/api/json/${id}` };
}

/**
 * Guarda descripciones
 */
export function saveDescriptions(descContent, id) {
  const filename = `${id}.json`;
  const filepath = path.join(DESC_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(descContent, null, 2), 'utf-8');
  return { filename, filepath, url: `/api/descriptions/${id}` };
}

/**
 * Lee archivo de audio (para streaming/descarga)
 */
export function getAudioFile(id) {
  const filepath = path.join(AUDIO_DIR, `${id}.mp3`);
  if (!fs.existsSync(filepath)) return null;
  return { filepath, filename: `${id}.mp3` };
}

/**
 * Lee archivo SRT
 */
export function getSRTFile(id) {
  const filepath = path.join(AUDIO_DIR, `${id}.srt`);
  if (!fs.existsSync(filepath)) return null;
  return { filepath, filename: `${id}.srt` };
}

/**
 * Lee JSON timestamps
 */
export function getJSONFile(id) {
  const filepath = path.join(AUDIO_DIR, `${id}.json`);
  if (!fs.existsSync(filepath)) return null;
  return { filepath, filename: `${id}.json` };
}

/**
 * Lee descripciones
 */
export function getDescriptionsFile(id) {
  const filepath = path.join(DESC_DIR, `${id}.json`);
  if (!fs.existsSync(filepath)) return null;
  return { filepath, filename: `${id}.json` };
}

/**
 * Limpia archivos más antiguos que X horas
 */
export function cleanupOldFiles(maxAgeHours = env.AUDIO_CLEANUP_HOURS) {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let deleted = 0;

  [AUDIO_DIR, SCRIPT_DIR, DESC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      try {
        const stats = fs.statSync(filepath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filepath);
          deleted++;
        }
      } catch {
        // Ignorar errores de archivos individuales
      }
    }
  });

  if (deleted > 0) {
    console.log(`🧹 Limpieza: ${deleted} archivos temporales eliminados (>${maxAgeHours}h)`);
  }
  return deleted;
}

/**
 * Inicia limpieza periódica
 */
export function startCleanupInterval(intervalHours = 6) {
  setInterval(() => cleanupOldFiles(), intervalHours * 60 * 60 * 1000);
  console.log(`🕐 Limpieza automática cada ${intervalHours}h activada`);
}

/**
 * Obtiene stats de almacenamiento
 */
export function getStorageStats() {
  let totalSize = 0;
  let fileCount = 0;

  [AUDIO_DIR, SCRIPT_DIR, DESC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    fileCount += files.length;
    for (const file of files) {
      try {
        totalSize += fs.statSync(path.join(dir, file)).size;
      } catch {}
    }
  });

  return {
    totalFiles: fileCount,
    totalSizeBytes: totalSize,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
    dirs: { audio: AUDIO_DIR, scripts: SCRIPT_DIR, descriptions: DESC_DIR },
  };
}

export default {
  saveAudio,
  saveScript,
  saveSRT,
  saveTimestampJSON,
  saveDescriptions,
  getAudioFile,
  getSRTFile,
  getJSONFile,
  getDescriptionsFile,
  cleanupOldFiles,
  startCleanupInterval,
  getStorageStats,
};