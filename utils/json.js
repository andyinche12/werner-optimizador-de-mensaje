// utils/json.js
// Utilidad robusta para extraer JSON de respuestas de LLM

import JSON5 from 'json5';

/**
 * Extrae y parsea JSON de una respuesta de texto (puede incluir markdown, texto extra, etc.)
 */
export function extractJson(text) {
  const raw = String(text || '').trim();
  
  // 1. Intento directo con JSON5 (soporta trailing commas, comments, etc.)
  try {
    return JSON5.parse(raw);
  } catch {}
  
  // 2. Buscar bloques de código ```json ... ```
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON5.parse(codeBlockMatch[1].trim());
    } catch {}
  }
  
  // 3. Buscar primer objeto/array JSON en el texto
  const startCandidates = [
    raw.indexOf('{'),
    raw.indexOf('['),
  ].filter(i => i >= 0);
  
  if (!startCandidates.length) {
    throw new Error('No se encontró un objeto JSON válido en la respuesta');
  }
  
  const start = Math.min(...startCandidates);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  
  if (end <= start) {
    throw new Error('El JSON devuelto está incompleto');
  }
  
  let jsonSlice = raw.slice(start, end + 1);
  
  // 4. Limpiar escapes comunes que rompen JSON5
  // El problema: LLM devuelve JSON con \" dentro de strings, pero el JSON ya está escapado
  // Ejemplo: "text": "print(\"Hola Mundo\")" viene como print(\\\"Hola Mundo\\\")
  // JSON5 no acepta \" dentro de strings, solo "
  
  // Estrategia: dentro de strings JSON, reemplazar \" por "
  // Heurística: buscar patrones de string JSON y limpiar escapes internos
  jsonSlice = cleanJsonEscapes(jsonSlice);
  
  try {
    return JSON5.parse(jsonSlice);
  } catch (e) {
    // 5. Último intento: limpieza más agresiva
    try {
      let cleaned = jsonSlice
        .replace(/\\\\"/g, '"')   // \\" -> "
        .replace(/\\\\\\/g, '\\')  // \\\\ -> \\
        .replace(/\\\\n/g, '\n')   // \\n -> \n
        .replace(/\\\\t/g, '\t');  // \\t -> \t
      return JSON5.parse(cleaned);
    } catch {
      throw new Error(`Error parseando JSON extraído: ${e.message}`);
    }
  }
}

/**
 * Limpia escapes dentro de strings JSON
 * Convierte \" a " dentro de valores de string JSON
 */
function cleanJsonEscapes(jsonStr) {
  // Regex para encontrar strings JSON (entre comillas, respetando escapes)
  // Este es un enfoque simple: buscar patrones clave: valor y limpiar el valor
  let result = jsonStr;
  
  // Buscar pares "key": "value" y limpiar el value
  result = result.replace(/"([^"]+)"\s*:\s*"([^"]*)"/g, (match, key, value) => {
    // Limpiar escapes dentro del value
    const cleanedValue = value
      .replace(/\\"/g, '"')      // \" -> "
      .replace(/\\\\/g, '\\')    // \\ -> \
      .replace(/\\n/g, '\n')     // \n -> newline
      .replace(/\\t/g, '\t')     // \t -> tab
      .replace(/\\r/g, '\r');    // \r -> carriage return
    return `"${key}": "${cleanedValue}"`;
  });
  
  // También manejar strings sin key (arrays de strings)
  result = result.replace(/"([^"]*)"/g, (match, value) => {
    // Solo procesar si parece un string con escapes problemáticos
    if (value.includes('\\"') || value.includes('\\\\')) {
      const cleaned = value
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
      return `"${cleaned}"`;
    }
    return match;
  });
  
  return result;
}

/**
 * Normaliza el objeto de análisis (scores 0-100)
 */
export function normalizeAnalysis(analysis) {
  const keys = ['objective', 'context', 'instructions', 'format', 'constraints'];
  const normalized = {};
  
  keys.forEach(key => {
    let value = Number(analysis?.[key] ?? 0);
    if (!Number.isFinite(value)) value = 0;
    normalized[key] = Math.max(0, Math.min(100, Math.round(value)));
  });
  
  const values = keys.map(k => normalized[k]);
  normalized.score = Math.round((values.reduce((a, b) => a + b, 0) / 5) * 100) / 100;
  
  return normalized;
}

/**
 * Normaliza salida de texto (string, object, array) a string plano
 */
export function normalizeOutput(value) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  
  if (typeof value === 'object') {
    const lines = [];
    const walk = (item, prefix = '') => {
      if (Array.isArray(item)) {
        item.forEach((v, i) => walk(v, `${prefix}${prefix ? ' ' : ''}${i + 1}.`));
        return;
      }
      if (item && typeof item === 'object') {
        for (const [key, val] of Object.entries(item)) {
          if (val && typeof val === 'object') {
            lines.push(`${prefix}${key}:`);
            walk(val, `${prefix}  `);
          } else {
            lines.push(`${prefix}${key}: ${String(val ?? '')}`);
          }
        }
        return;
      }
      lines.push(`${prefix}${String(item ?? '')}`);
    };
    walk(value);
    return lines.join('\n').trim();
  }
  
  return String(value);
}

export default { extractJson, normalizeAnalysis, normalizeOutput };