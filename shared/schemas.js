// shared/schemas.js
// Esquemas Zod compartidos (validación backend + tipos frontend)

import { z } from 'zod';

// Tipos de contenido soportados
export const ContentTypeSchema = z.enum([
  'historias',
  'educativo',
  'motivacion',
  'finanzas_personales',
  'top_listas',
  'misterio',
  'resumenes_libros',
  'noticias_nicho',
  'otro',
]);

// Tono de narración
export const ToneSchema = z.enum([
  'cercano',
  'profesional',
  'entusiasta',
  'calmado',
  'dramatico',
  'susurrado',
  'neutral',
]);

// Duración objetivo
export const DurationSchema = z.enum([
  '30s',
  '60s',
  '90s',
  '120s',
  '180s',
  'libre',
]);

// Paso 1: Idea inicial
export const IdeaInputSchema = z.object({
  idea: z.string().min(10, 'La idea debe tener al menos 10 caracteres').max(5000),
  contentType: ContentTypeSchema,
  duration: DurationSchema,
  tone: ToneSchema.default('neutral'),
  customInstructions: z.string().max(2000).optional(),
});

// Paso 2: Estructura elegida
export const StructureOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  outline: z.array(z.string()),
  why: z.string(),
});

export const ArchitectOutputSchema = z.object({
  structures: z.array(StructureOptionSchema).length(3),
});

export const StructureChoiceSchema = z.object({
  structureId: z.string(),
  structure: StructureOptionSchema,
});

// Paso 3: Guion generado
export const ScriptSceneSchema = z.object({
  text: z.string(),
  visual: z.string().optional(),
  tone: z.string().optional(),
});

export const ScriptOutputSchema = z.object({
  script: z.string(),
  wordCount: z.number().int().positive(),
  estimatedDuration: z.number().int().positive(),
  scenes: z.array(ScriptSceneSchema),
});

// Paso 4: Configuración de voz
export const VoiceConfigSchema = z.object({
  voiceId: z.string().default('es-ES-AlvaroNeural'),
  rate: z.string().default('+0%'),
  pitch: z.string().default('+0Hz'),
  volume: z.string().default('+0%'),
  toneOverrides: z.record(z.object({
    rate: z.string().optional(),
    pitch: z.string().optional(),
    volume: z.string().optional(),
    style: z.string().optional(),
  })).optional(),
});

// Paso 5: Resultado final
export const AudioResultSchema = z.object({
  id: z.string().uuid(),
  audioUrl: z.string().url(),
  srtUrl: z.string().url(),
  jsonUrl: z.string().url(),
  txtUrl: z.string().url(),
  duration: z.number(),
  size: z.number(),
  metadata: z.object({
    title: z.string(),
    wordCount: z.number(),
    voice: z.string(),
    contentType: ContentTypeSchema,
    tone: ToneSchema,
    createdAt: z.string().datetime(),
  }),
});

// Descripciones generadas
export const DescriptionsOutputSchema = z.object({
  titles: z.array(z.string()).length(3),
  youtube: z.object({
    description: z.string(),
    chapters: z.array(z.object({ time: z.string(), title: z.string() })),
    hashtags: z.array(z.string()),
  }),
  tiktok: z.object({
    description: z.string(),
    hashtags: z.array(z.string()),
  }),
  shorts: z.object({
    description: z.string(),
    hashtags: z.array(z.string()),
  }),
  thumbnailPrompts: z.array(z.string()).length(3),
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    passed: z.boolean(),
  })),
});

// Aprendizaje (feedback loop)
export const LearnInputSchema = z.object({
  videos: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    views: z.number().int().nonnegative(),
    watchTime: z.number().int().nonnegative(),
    ctr: z.number().min(0).max(100).optional(),
    likes: z.number().int().nonnegative().optional(),
    comments: z.number().int().nonnegative().optional(),
    shares: z.number().int().nonnegative().optional(),
    platform: z.enum(['youtube', 'tiktok', 'shorts']),
    publishedAt: z.string().datetime(),
  })).min(1).max(20),
});

export const LearnOutputSchema = z.object({
  titleFormulas: z.array(z.string()),
  hookPatterns: z.array(z.string()),
  structurePatterns: z.array(z.string()),
  ctaPatterns: z.array(z.string()),
  recommendedTones: z.array(z.string()),
  optimalDuration: z.number().int().positive(),
  keywords: z.array(z.string()),
});

// Biblioteca (IndexedDB sync)
export const LibraryItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  idea: z.string(),
  contentType: ContentTypeSchema,
  tone: ToneSchema,
  duration: DurationSchema,
  script: z.string(),
  audioUrl: z.string().url(),
  srtUrl: z.string().url(),
  jsonUrl: z.string().url(),
  descriptions: DescriptionsOutputSchema.optional(),
  voiceConfig: VoiceConfigSchema,
  metadata: z.object({
    wordCount: z.number(),
    estimatedDuration: z.number(),
    actualDuration: z.number().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    version: z.number().int().default(1),
    tags: z.array(z.string()).default([]),
  }),
});

// Validación de entrada para endpoints
export const GenerateRequestSchema = z.object({
  idea: IdeaInputSchema,
  structureChoice: StructureChoiceSchema.optional(),
  script: ScriptOutputSchema.optional(),
  voiceConfig: VoiceConfigSchema.optional(),
  skipTTS: z.boolean().default(false),
});

export const TTSRequestSchema = z.object({
  script: z.string().min(1).max(50000),
  voiceConfig: VoiceConfigSchema,
  splitChunks: z.boolean().default(true),
});

export const DescriptionsRequestSchema = z.object({
  script: z.string().min(1),
  metadata: z.object({
    title: z.string(),
    contentType: ContentTypeSchema,
    tone: ToneSchema,
    niche: z.string().optional(),
  }),
});

export const LearnRequestSchema = z.object({
  videos: LearnInputSchema.shape.videos,
});

// Nota: Los tipos TypeScript se generan automáticamente con 'zod-to-ts' si se necesitan
// Para JSDoc en JS puro, usar: /** @typedef {z.infer<typeof IdeaInputSchema>} IdeaInput */