// services/groq.js
// Cliente Groq centralizado con reintentos, timeout y logging

import Groq from 'groq-sdk';
import { env } from '../config/env.js';

const MODEL = 'openai/gpt-oss-120b';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4000;
const MAX_RETRIES = 3;
const BASE_TIMEOUT = 60000;

function createClient() {
  return new Groq({
    apiKey: env.GROQ_API_KEY,
    timeout: BASE_TIMEOUT,
    maxRetries: 0, // Manejamos reintentos manualmente para mejor control
  });
}

/**
 * Ejecuta chat completion con reintentos exponenciales y logging
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Object} options
 * @param {number} options.maxTokens
 * @param {number} options.temperature
 * @param {number} options.retries
 * @returns {Promise<string>} Contenido de la respuesta
 */
export async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    retries = MAX_RETRIES,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const client = createClient();

    try {
      console.log(`[Groq] Intento ${attempt}/${retries} - model: ${MODEL}, tokens: ${maxTokens}, temp: ${temperature}`);

      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content || '';

      if (!content.trim()) {
        throw new Error('Respuesta vacía de Groq');
      }

      console.log(`[Groq] ✓ Completado (${content.length} chars)`);
      return content;

    } catch (error) {
      lastError = error;
      const isRateLimit = error.status === 429 || error.message?.includes('rate limit');
      const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
      const isRetryable = isRateLimit || isTimeout || (error.status >= 500 && error.status < 600);

      console.error(`[Groq] ✗ Intento ${attempt} falló:`, error.message);

      if (attempt < retries && isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 2s, 4s, 8s max 10s
        console.log(`[Groq] Reintentando en ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // No reintentable o último intento
      break;
    }
  }

  // Todos los intentos fallaron
  const message = lastError?.message || 'Error desconocido en Groq';
  console.error('[Groq] Todos los intentos fallaron:', message);
  throw new Error(`Groq error tras ${retries} intentos: ${message}`);
}

/**
 * Versión simplificada para compatibilidad con código existente
 */
export async function simpleChatCompletion(systemPrompt, userPrompt, maxTokens = DEFAULT_MAX_TOKENS) {
  return chatCompletion(systemPrompt, userPrompt, { maxTokens });
}

export default { chatCompletion, simpleChatCompletion };