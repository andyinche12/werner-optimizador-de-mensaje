// config/tts.js
// Configuración de voces Edge TTS y builder SSML

export const EDGE_TTS_VOICES = {
  'es-ES-AlvaroNeural': { label: 'Álvaro (España, masculino)', gender: 'Male', locale: 'es-ES', style: 'neutral' },
  'es-ES-ElviraNeural': { label: 'Elvira (España, femenina)', gender: 'Female', locale: 'es-ES', style: 'neutral' },
  'es-MX-DaliaNeural': { label: 'Dalia (México, femenina)', gender: 'Female', locale: 'es-MX', style: 'neutral' },
  'es-MX-JorgeNeural': { label: 'Jorge (México, masculino)', gender: 'Male', locale: 'es-MX', style: 'neutral' },
  'es-AR-ElenaNeural': { label: 'Elena (Argentina, femenina)', gender: 'Female', locale: 'es-AR', style: 'neutral' },
  'es-AR-TomasNeural': { label: 'Tomás (Argentina, masculino)', gender: 'Male', locale: 'es-AR', style: 'neutral' },
  'es-CO-SalomeNeural': { label: 'Salomé (Colombia, femenina)', gender: 'Female', locale: 'es-CO', style: 'neutral' },
  'es-CO-GonzaloNeural': { label: 'Gonzalo (Colombia, masculino)', gender: 'Male', locale: 'es-CO', style: 'neutral' },
  'es-US-AlonsoNeural': { label: 'Alonso (EE.UU., masculino)', gender: 'Male', locale: 'es-US', style: 'neutral' },
  'es-US-PalomaNeural': { label: 'Paloma (EE.UU., femenina)', gender: 'Female', locale: 'es-US', style: 'neutral' },
};

export const DEFAULT_VOICE = 'es-ES-AlvaroNeural';
export const DEFAULT_RATE = '+0%';
export const DEFAULT_PITCH = '+0Hz';
export const DEFAULT_VOLUME = '+0%';

export const SSML_STYLES = {
  neutral: { style: 'neutral', role: null },
  cheerful: { style: 'cheerful', role: null },
  sad: { style: 'sad', role: null },
  angry: { style: 'angry', role: null },
  fearful: { style: 'fearful', role: null },
  serious: { style: 'serious', role: null },
  friendly: { style: 'friendly', role: null },
  whispering: { style: 'whispering', role: null },
  storytelling: { style: 'storytelling', role: null },
};

export const TONE_TO_SSML = {
  'cercano': { style: 'friendly', rate: '-5%', pitch: '+5Hz' },
  'profesional': { style: 'serious', rate: '+0%', pitch: '+0Hz' },
  'entusiasta': { style: 'cheerful', rate: '+10%', pitch: '+10Hz' },
  'calmado': { style: 'neutral', rate: '-10%', pitch: '-5Hz' },
  'dramatico': { style: 'storytelling', rate: '-5%', pitch: '+5Hz' },
  'susurrado': { style: 'whispering', rate: '-20%', pitch: '-10Hz', volume: '-20%' },
  'neutral': { style: 'neutral', rate: '+0%', pitch: '+0Hz' },
};

export const TTS_LIMITS = {
  maxCharsPerRequest: 5000,
  maxCharsTotal: 50000,
  supportedFormats: ['audio-24khz-48kbitrate-mono-mp3', 'audio-24khz-96kbitrate-mono-mp3'],
  defaultFormat: 'audio-24khz-48kbitrate-mono-mp3',
};