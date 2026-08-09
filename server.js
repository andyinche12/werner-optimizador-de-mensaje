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

const optimizerSystemPrompt = `
Eres un arquitecto experto en ingeniería de prompts. Tu tarea es transformar el mensaje del usuario en un prompt largo, preciso, estructurado y reutilizable, sin cambiar su intención original.

REGLAS DE COMBINACIÓN DE ESTILO Y TONO (MUY IMPORTANTE):
El usuario elegirá un ESTILO y un TONO. Debes aplicar AMBOS al mismo tiempo.
- El ESTILO define la estructura y el formato (Auto, Formal, Creativo, Técnico).
- El TONO define las palabras, la actitud y la emoción (Auto, Rápido, Formal, Cariñoso, Coqueto).

🚨 REGLAS DE CALIDEZ Y EMOJIS:
Si el TONO es "Cariñoso" o "Coqueto":
- El texto debe sonar HUMANO, natural y cercano. NO escribas frases poéticas, dramáticas o de novela antigua.
- Usa emojis modernos (❤️, 😊, ✨, 🌸, 😉, 😏, 😜) para dar calidez.
- Si el ESTILO es "Formal" y el TONO es "Cariñoso", usa un lenguaje profesional pero con un toque cálido y amable.

Analiza cinco dimensiones de 0 a 100 (objective, context, instructions, format, constraints).
El score debe ser el promedio matemático de estas cinco métricas.
optimizedPrompt debe ser TEXTO PLANO, no un objeto.
Responde EXCLUSIVAMENTE con JSON5 válido, sin texto extra.
`;

app.post("/api/optimize", async (req, res) => {
  try {
    const { message, style = "Auto", tone = "Auto", detail = "Equilibrado" } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Escribe un mensaje para optimizar." });
    }

    const textToneInstructions = {
      "Auto": "Elige el tono más natural y acorde al mensaje.",
      "Rápido": "Sé directo, conciso y ve al grano. Sin rodeos.",
      "Formal": "Usa un lenguaje profesional, respetuoso y estructurado.",
      "Cariñoso": "Escribe con mucha calidez, empatía y cercanía. Utiliza emojis de cariño (❤️, 😊, 🌸, ✨). El tono debe ser como el de un amigo muy querido.",
      "Coqueto": "Escribe con un tono juguetón, divertido, pícaro y moderno. Utiliza emojis coquetos (😉, 😏, 😜, ✨). No suenes anticuado, sé natural y simpático."
    };

    const userPrompt = `Estilo: ${style}\nTono: ${tone}\nInstrucciones de tono: ${textToneInstructions[tone] || textToneInstructions["Auto"]}\nDetalle: ${detail}\n\nMensaje original:\n${String(message).trim()}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ werner Optimizador de Mensaje ejecutándose en http://localhost:${PORT}`);
});