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

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function friendlyGroqError(error) {
  const status = error?.status ?? error?.statusCode;
  const message = String(error?.message || "").toLowerCase();

  if (status === 429 || message.includes("rate limit") || message.includes("quota")) {
    return "Límite de peticiones excedido. Espera unos minutos y vuelve a intentarlo.";
  }
  if (error?.code === "ETIMEDOUT" || error?.code === "ECONNABORTED" || message.includes("timeout")) {
    return "La solicitud tardó demasiado. Revisa tu conexión a internet.";
  }
  return `Error del servidor: ${error?.message || "Ocurrió un error inesperado."}`;
}

function normalizeOutput(value) {
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

// ============================================================
// INSTRUCCIONES PARA DOS MODOS
// ============================================================
const getSystemPrompt = (mode) => {
  const baseInstructions = `
DEBES RESPONDER EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO.
NO escribas absolutamente nada más, ni saludos, ni explicaciones, ni texto fuera del JSON.
El JSON DEBE tener esta estructura exacta:
{
  "optimizedPrompt": "tu respuesta aquí",
  "analysis": {
    "score": 0-100,
    "objective": 0-100,
    "context": 0-100,
    "instructions": 0-100,
    "format": 0-100,
    "constraints": 0-100
  }
}`;

  if (mode === 'reply') {
    return `
Eres un experto en comunicación y redacción.
El usuario te dará un mensaje que alguien le envió. Genera una respuesta perfecta para ese mensaje.
${baseInstructions}`;
  } else {
    return `
Eres un experto en redacción y mejora de textos.
El usuario te dará un mensaje que quiere enviar. Reescribe y optimiza ese mensaje para que sea mejor.
${baseInstructions}`;
  }
};

app.post("/api/optimize", async (req, res) => {
  try {
    const { message, style = "Auto", tone = "Auto", detail = "Equilibrado", mode = "reply" } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Escribe un mensaje." });
    }

    const textToneInstructions = {
      "Auto": "Elige el tono más natural.",
      "Rápido": "Sé directo, conciso y ve al grano.",
      "Formal": "Lenguaje profesional y estructurado.",
      "Cariñoso": "Calidez, empatía y emojis (❤️, 😊, 🌸, ✨).",
      "Coqueto": "Tono juguetón y divertido con emojis (😉, 😏, 😜, ✨)."
    };

    const userPrompt = `
Modo: ${mode === 'reply' ? 'Responder a un mensaje recibido' : 'Mejorar mi mensaje'}
Estilo: ${style}
Tono: ${tone}
Instrucciones de tono: ${textToneInstructions[tone] || textToneInstructions["Auto"]}
Detalle: ${detail}

CONTENIDO:
${String(message).trim()}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      messages: [
        { role: "system", content: getSystemPrompt(mode) },
        { role: "user", content: userPrompt }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "";
    
    // === ESCUDO DE SEGURIDAD ===
    let parsed;
    let optimizedPrompt;
    let analysis;

    try {
      parsed = extractJson(content);
      optimizedPrompt = normalizeOutput(parsed.optimizedPrompt);
      analysis = normalizeAnalysis(parsed.analysis || {});
      if (!optimizedPrompt) throw new Error("Prompt vacío");
    } catch (error) {
      console.warn("La IA no devolvió JSON válido. Usando mensaje de respaldo.");
      optimizedPrompt = "Lo siento, no entendí el mensaje. Por favor, intenta de nuevo con un mensaje más claro.";
      analysis = { score: 0, objective: 0, context: 0, instructions: 0, format: 0, constraints: 0 };
    }

    return res.json({ optimizedPrompt, analysis });
  } catch (error) {
    console.error("Optimize error:", error);
    return res.status(500).json({ error: friendlyGroqError(error) });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ werner Optimizador de Mensaje ejecutándose en http://localhost:${PORT}`);
});