// routes/audio.js
// Endpoints: GET /api/audio/:id, GET /api/srt/:id, GET /api/json/:id, GET /api/script/:id

import express from 'express';
import { getAudioFile, getSRTFile, getJSONFile, getDescriptionsFile } from '../services/storage.js';
import fs from 'fs';

const router = express.Router();

// GET /api/audio/:id - Stream/descarga MP3
router.get('/audio/:id', (req, res) => {
  const file = getAudioFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Audio no encontrado' });
  
  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Disposition': `inline; filename="${file.filename}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  });
  
  res.sendFile(file.filepath);
});

// GET /api/srt/:id - Descarga SRT
router.get('/srt/:id', (req, res) => {
  const file = getSRTFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'SRT no encontrado' });
  
  res.set({
    'Content-Type': 'text/srt; charset=utf-8',
    'Content-Disposition': `attachment; filename="${file.filename}"`,
  });
  res.sendFile(file.filepath);
});

// GET /api/vtt/:id - Descarga VTT (convertido desde SRT)
router.get('/vtt/:id', (req, res) => {
  const srtFile = getSRTFile(req.params.id);
  if (!srtFile) return res.status(404).json({ error: 'VTT no encontrado (SRT base no existe)' });
  
  // Leer SRT y convertir a VTT al vuelo
  const srtContent = fs.readFileSync(srtFile.filepath, 'utf-8');
  const vttContent = convertSRTToVTT(srtContent);
  
  res.set({
    'Content-Type': 'text/vtt; charset=utf-8',
    'Content-Disposition': `attachment; filename="${req.params.id}.vtt"`,
  });
  res.send(vttContent);
});

// GET /api/json/:id - Descarga JSON timestamps
router.get('/json/:id', (req, res) => {
  const file = getJSONFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'JSON no encontrado' });
  
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${file.filename}"`,
  });
  res.sendFile(file.filepath);
});

// GET /api/script/:id - Descarga guion TXT
router.get('/script/:id', (req, res) => {
  const file = getDescriptionsFile(req.params.id); // reutilizo storage para scripts
  // En realidad los scripts están en SCRIPT_DIR, pero storage.js los guarda con saveScript
  // Por simplicidad, intentamos leer de ahí
  import('fs').then(fs => {
    import('path').then(path => {
      const filepath = path.join('./temp/scripts', `${req.params.id}.txt`);
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Guion no encontrado' });
      
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${req.params.id}.txt"`,
      });
      res.sendFile(filepath);
    });
  });
});

// GET /api/descriptions/:id - Descarga descripciones JSON
router.get('/descriptions/:id', (req, res) => {
  const file = getDescriptionsFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Descripciones no encontradas' });
  
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${file.filename}"`,
  });
  res.sendFile(file.filepath);
});

// GET /api/storage/stats - Stats de almacenamiento (admin)
router.get('/storage/stats', (req, res) => {
  import('../services/storage.js').then(({ getStorageStats }) => {
    res.json(getStorageStats());
  });
});

// POST /api/storage/cleanup - Limpieza manual (admin)
router.post('/storage/cleanup', (req, res) => {
  import('../services/storage.js').then(({ cleanupOldFiles }) => {
    const deleted = cleanupOldFiles();
    res.json({ deleted, message: `Limpieza completada: ${deleted} archivos eliminados` });
  });
});

/**
 * Convierte contenido SRT a WebVTT
 * Cambios: cabecera WEBVTT, coma → punto en milisegundos
 */
function convertSRTToVTT(srtContent) {
  let vtt = 'WEBVTT\n\n';
  
  // SRT: 00:00:01,500 --> 00:00:04,200
  // VTT: 00:00:01.500 --> 00:00:04.200
  vtt += srtContent
    .replace(/,(\d{3}) -->/g, '.$1 -->')  // coma a punto en timestamp inicio
    .replace(/--> ,(\d{3})/g, '--> .$1')   // coma a punto en timestamp fin (por si acaso)
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); // reemplaza todas las comas en timestamps
  
  return vtt;
}

export default router;