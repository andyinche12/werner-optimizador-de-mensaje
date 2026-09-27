// utils/ssml.js
// Builder SSML para Edge TTS con soporte de marcas personalizadas

import { SSML_STYLES } from '../config/tts.js';

/**
 * Convierte texto con marcas [pausa:1s] [énfasis]texto[/énfasis] [tono:estilo]...[/tono] [visual:...]
 * a SSML válido para Edge TTS (con mstts:express-as)
 */
export function buildSSML(text, voiceId, globalConfig = {}, toneOverrides = {}) {
  // Escapar XML
  const escapeXml = (str) => str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');

  // Procesar marcas de tono: [tono:estilo]...[/tono]
  let processed = text;
  const toneRegex = /\[tono:(\w+)\]([\s\S]*?)\[\/tono\]/g;
  processed = processed.replace(toneRegex, (match, style, content) => {
    const styleConfig = SSML_STYLES[style] || SSML_STYLES.neutral;
    const rate = toneOverrides[style]?.rate || globalConfig.rate || '+0%';
    const pitch = toneOverrides[style]?.pitch || globalConfig.pitch || '+0Hz';
    const volume = toneOverrides[style]?.volume || globalConfig.volume || '+0%';
    return `<mstts:express-as style="${styleConfig.style}" role="${styleConfig.role || ''}"><prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escapeXml(content)}</prosody></mstts:express-as>`;
  });

  // Procesar énfasis: [énfasis]texto[/énfasis]
  processed = processed.replace(/\[énfasis\]([\s\S]*?)\[\/énfasis\]/g, (match, content) => {
    return `<emphasis level="strong">${escapeXml(content)}</emphasis>`;
  });

  // Procesar pausas: [pausa:1s] o [pausa:500ms]
  processed = processed.replace(/\[pausa:(\d+(?:\.\d+)?)(s|ms)\]/g, (match, value, unit) => {
    const ms = unit === 's' ? value * 1000 : parseInt(value);
    return `<break time="${ms}ms"/>`;
  });

  // Eliminar marcas visuales (no van al audio)
  processed = processed.replace(/\[visual:([^\]]+)\]/g, '');

  // Limpiar saltos de línea múltiples
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // Configuración global de prosodia
  const rate = globalConfig.rate || '+0%';
  const pitch = globalConfig.pitch || '+0Hz';
  const volume = globalConfig.volume || '+0%';

  // Construir SSML completo
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-ES">
  <voice name="${voiceId}">
    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
${processed.split('\n').map(line => line.trim() ? `      ${escapeXml(line)}` : '      <break time="300ms"/>').join('\n')}
    </prosody>
  </voice>
</speak>`;

  return ssml;
}

/**
 * Genera SSML simple para preview de un párrafo
 */
export function buildSimpleSSML(text, voiceId, rate = '+0%', pitch = '+0Hz', volume = '+0%') {
  const escapeXml = (str) => str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-ES">
  <voice name="${voiceId}">
    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
}

export default { buildSSML, buildSimpleSSML };