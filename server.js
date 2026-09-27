// server.js
// Punto de entrada principal - Backend modular para werner-audio-factory

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';

// Rutas modulares
import scriptRoutes from './routes/script.js';
import ttsRoutes from './routes/tts.js';
import generateRoutes from './routes/generate.js';
import descriptionsRoutes from './routes/descriptions.js';
import learnRoutes from './routes/learn.js';
import audioRoutes from './routes/audio.js';

// Servicios
import { startCleanupInterval } from './services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = env.PORT;

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================

// CORS configurado
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting global (solo en producción)
if (env.NODE_ENV === 'production') {
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);
}

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Logging de requests (dev)
if (env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
}

// ============================================================
// RUTAS API
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    env: env.NODE_ENV,
  });
});

// Rutas modulares
app.use('/api/script', scriptRoutes);        // Arquitecto + Escritor
app.use('/api/tts', ttsRoutes);              // Edge TTS + Preview
app.use('/api/generate', generateRoutes);    // Pipeline completo
app.use('/api/descriptions', descriptionsRoutes); // SEO + Monetización
app.use('/api/learn', learnRoutes);          // Aprendizaje de tops
app.use('/api', audioRoutes);                // Archivos: audio, srt, json, script

// ============================================================
// SERVIR FRONTEND (PWA)
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - servir index.html para rutas no-API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// ERROR HANDLING
// ============================================================

// 404 para API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  
  // Errores de validación Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({ 
      error: 'Datos inválidos', 
      details: err.flatten?.() || err.errors 
    });
  }
  
  // Errores de rate limit
  if (err.name === 'RateLimitError') {
    return res.status(429).json({ error: 'Demasiadas peticiones' });
  }
  
  // Error genérico
  const status = err.status || err.statusCode || 500;
  const message = env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message || 'Error desconocido';
  
  res.status(status).json({ error: message });
});

// ============================================================
// INICIO
// ============================================================

// Crear directorio temp si no existe
import('fs').then(fs => {
  if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });
});

// Iniciar limpieza automática
startCleanupInterval(6); // cada 6 horas

app.listen(PORT, () => {
  console.log(`✅ werner Audio Factory v2.0 ejecutándose en http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Frontend URL: ${env.FRONTEND_URL}`);
  console.log(`   Temp dir: ${env.TEMP_DIR}`);
});

export default app;