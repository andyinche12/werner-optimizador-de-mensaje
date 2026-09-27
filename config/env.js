// config/env.js
// Validación y exportación de variables de entorno

import dotenv from 'dotenv';
import { z } from 'zod';

// Cargar .env al importar este módulo
dotenv.config();

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY es obligatoria'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  TEMP_DIR: z.string().default('./temp'),
  MAX_SCRIPT_LENGTH: z.coerce.number().default(50000),
  MAX_TTS_CHARS: z.coerce.number().default(5000),
  AUDIO_CLEANUP_HOURS: z.coerce.number().default(24),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AFFILIATE_BROKER: z.string().default('{{BROKER_LINK}}'),
  AFFILIATE_TEMPLATE: z.string().default('{{TEMPLATE_LINK}}'),
  AFFILIATE_BOOK: z.string().default('{{BOOK_LINK}}'),
  CHANNEL_NAME: z.string().default('Mi Canal'),
  NICHE: z.string().default('general'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Error en variables de entorno:');
    parsed.error.errors.forEach(e => console.error(`  - ${e.path.join('.')}: ${e.message}`));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export default env;