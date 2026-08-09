import express from "express";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import JSON5 from "json5";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GROQ_API_KEY) {
  console.error("❌ ERROR: Falta GROQ_API_KEY en el archivo .env");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 60000,
  maxRetries: 3
});

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------
// 1. MANEJO DE ERRORES (Ahora muestra el error real de Groq)
// ---------------------------------------------------------
function friendlyGroqError(error) {
  const status = error?.status ?? error?.statusCode;
  const message = String(error?.message || "").toLowerCase();
  const errorCode = error?.error?.code || "";

  if (errorCode === "model_not_found" || errorCode === "model_decommissioned" || message.includes("does not exist")) {
    return `El modelo de IA seleccionado no está disponible o fue descontinuado. Revisa la variable GROQ_VISION_MODEL en tu archivo .env y actualízala según https://console.groq.com/docs/models`;
  }
  if (status === 429 || message.includes("rate limit") || message.includes("quota")) {
    return "Límite de peticiones de Groq excedido. Espera unos minutos y vuelve a intentarlo.";
  }
  if (error?.code === "ETIMEDOUT" || error?.code === "ECONNABORTED" || message.includes("timeout")) {
    return "La solicitud tardó demasiado. Revisa tu conexión a internet.";
  }
  if (error?.code === "ENOTFOUND" || error?.code === "ECONNRESET" || message.includes("network")) {
    return "No se pudo conectar con la IA. Revisa tu conexión.";
  }
  
  // 🔥 CAMBIO CLAVE: Devuelve el mensaje real de Groq para saber qué está fallando
  return `Error del servidor de Groq: ${error?.message || "Ocurrió un error inesperado."}`;
}

// ---------------------------------------------------------
// 2. FUNCIONES AUXILIARES DE PARSEO
// ---------------------------------------------------------
function normalizeOptimizedPrompt(value) {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (typeof value === "object") {
    const lines = [];
    const walk = (item, prefix = "") => {
      if (Array.isArray(item)) {
        item.forEach((v, i) => walk(v, `${prefix}${prefix ? " " : ""}${i + 1}.`));
        return;
      }
      if (item && typeof item === "object") {
        for (const [key, val] of Object.entries(item)) {
          if (val && typeof val === "object") {
            lines.push(`${prefix}${key}:`);
            walk(val, `${prefix}  `);
          } else {
            lines.push(`${prefix}${key}: ${String(val ?? "")}`);
          }
        }
        return;
      }
      lines.push(`${prefix}${String(item ?? "")}`);
    };
    walk(value);
    return lines.join("\n").trim();
  }
  return String(value);
}

function extractJson(text) {
  const raw = String(text || "").trim();
  try { return JSON5.parse(raw); } catch {}
  const startCandidates = [raw.indexOf("{"), raw.indexOf("[")].filter(i => i >= 0);
  if (!startCandidates.length) throw new Error("No se encontró un objeto JSON válido.");
  const start = Math.min(...startCandidates);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (end <= start) throw new Error("El JSON devuelto está incompleto.");
  return JSON5.parse(raw.slice(start, end + 1));
}

function normalizeAnalysis(analysis) {
  const keys = ["objective", "context", "instructions", "format", "constraints"];
  const normalized = {};
  keys.forEach((key) => {
    let value = Number(analysis?.[key] ?? 0);
    if (!Number.isFinite(value)) value = 0;
    normalized[key] = Math.max(0, Math.min(100, Math.round(value)));
  });
  const values = keys.map(k => normalized[k]);
  normalized.score = Math.round((values.reduce((a, b) => a + b, 0) / 5) * 100) / 100;
  return normalized;
}

// ---------------------------------------------------------
// 3. RUTA: OPTIMIZADOR DE PROMPTS (Con instrucciones de combinación)
// ---------------------------------------------------------
const optimizerSystemPrompt = `
Eres un arquitecto experto en ingeniería de prompts. Tu tarea es transformar el mensaje del usuario en un prompt largo, preciso, estructurado y reutilizable, sin cambiar su intención original.

REGLAS DE COMBINACIÓN DE ESTILO Y TONO (MUY IMPORTANTE):
El usuario elegirá un ESTILO y un TONO. Debes aplicar AMBOS al mismo tiempo.
- El ESTILO define la estructura y el formato (Auto, Formal, Creativo, Técnico).
- El TONO define las palabras, la actitud y la emoción (Auto, Rápido, Formal, Cariñoso, Coqueto).

Ejemplo: Si el Estilo es "Formal" y el Tono es "Coqueto", el texto debe tener la estructura y educación de un texto Formal, pero con palabras juguetonas y simpáticas.
Si el Estilo es "Creativo" y el Tono es "Cariñoso", el texto debe ser imaginativo pero escrito con calidez.
NUNCA ignores el Tono elegido por el usuario.

Analiza cinco dimensiones de 0 a 100 (objective, context, instructions, format, constraints).
El score debe ser el promedio matemático de estas cinco métricas.
optimizedPrompt debe ser TEXTO PLANO, no un objeto.
Responde EXCLUSIVAMENTE con JSON5 válido, sin texto extra.
Estructura obligatoria: { optimizedPrompt: "...", analysis: { objective: 0, context: 0, instructions: 0, format: 0, constraints: 0, score: 0 } }
`;

app.post("/api/optimize", async (req, res) => {
  try {
    const { message, style = "Auto", tone = "Auto", detail = "Equilibrado" } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Escribe un mensaje para optimizar." });
    }

    const textToneInstructions = {
      "Auto": "Elige el tono más acorde al mensaje.",
      "Rápido": "Sé directo, conciso y ve al grano.",
      "Formal": "Usa un lenguaje profesional, respetuoso y estructurado.",
      "Cariñoso": "Escribe con empatía, calidez y amabilidad.",
      "Coqueto": "Usa un tono juguetón, simpático y ligeramente coqueto."
    };

    const userPrompt = `Estilo: ${style}\nTono: ${tone}\nInstrucciones de tono: ${textToneInstructions[tone] || textToneInstructions["Auto"]}\nDetalle: ${detail}\n\nMensaje original:\n${String(message).trim()}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.35,
      messages: [
        { role: "system", content: optimizerSystemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    const analysis = normalizeAnalysis(parsed.analysis || {});
    const optimizedPrompt = normalizeOptimizedPrompt(parsed.optimizedPrompt);

    if (!optimizedPrompt) throw new Error("La IA no generó un prompt válido.");
    return res.json({ optimizedPrompt, analysis });
  } catch (error) {
    console.error("Optimize error:", error);
    return res.status(500).json({ error: friendlyGroqError(error) });
  }
});

// ---------------------------------------------------------
// 4. RUTA: ASISTENTE DE VISIÓN
// ---------------------------------------------------------
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview";

app.post("/api/vision", async (req, res) => {
  try {
    const { image, tone = "Rápido" } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Debes subir una imagen." });
    }

    const toneInstructions = {
      "Rápido": "Sé directo y breve.",
      "Formal": "Responde de forma profesional, clara y estructurada.",
      "Cariñoso": "Responde con calidez y empatía.",
      "Coqueto": "Usa un tono juguetón y ligeramente coqueto."
    };

    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.45,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analiza esta imagen y responde en español.\nTono: ${tone}.\nInstrucciones: ${toneInstructions[tone] || toneInstructions["Rápido"]}\n\nNo inventes información que no sea visible.`
            },
            { type: "image_url", image_url: { url: image } }
          ]
        }
      ]
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("La IA no devolvió texto.");
    return res.json({ text });
  } catch (error) {
    console.error("Vision error details:", JSON.stringify(error, null, 2));
    const message = String(error?.message || "").toLowerCase();
    if (error?.error?.code === "model_not_found" || error?.error?.code === "model_decommissioned" || message.includes("does not exist")) {
      return res.status(400).json({
        error: `El modelo '${VISION_MODEL}' fue descontinuado por Groq. Ve a https://console.groq.com/docs/models, busca el nuevo nombre del modelo de visión y actualiza la variable GROQ_VISION_MODEL en tu panel de entorno de Render, luego reinicia el servicio.`
      });
    }
    return res.status(500).json({ error: friendlyGroqError(error) });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Werner Optimizador de Mensaje corriendo en http://localhost:${PORT}`);
});