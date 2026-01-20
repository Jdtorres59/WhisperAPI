import fs from "fs/promises";
import os from "os";
import path from "path";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const PER_IP_LIMIT = 3;
const GLOBAL_LIMIT = 20;
const RATE_FILE = path.join(os.tmpdir(), "speak2send-rate.json");
const ALLOWED_EXTENSIONS = new Set(["mp3", "m4a", "wav", "webm", "ogg"]);

const rateLimitMessages = {
  ip: "Llegaste al limite diario (3). Intenta manana.",
  global: "El demo llego al limite global de hoy (20). Intenta mas tarde."
};

type RateStore = {
  date: string;
  global: number;
  perIp: Record<string, number>;
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function readRateStore(): Promise<RateStore> {
  try {
    const data = await fs.readFile(RATE_FILE, "utf8");
    return JSON.parse(data) as RateStore;
  } catch {
    return { date: getTodayKey(), global: 0, perIp: {} };
  }
}

async function writeRateStore(store: RateStore) {
  await fs.writeFile(RATE_FILE, JSON.stringify(store), "utf8");
}

async function enforceRateLimit(ip: string) {
  const today = getTodayKey();
  const store = await readRateStore();

  if (store.date !== today) {
    store.date = today;
    store.global = 0;
    store.perIp = {};
  }

  const ipCount = store.perIp[ip] ?? 0;
  if (ipCount >= PER_IP_LIMIT) {
    return { allowed: false, message: rateLimitMessages.ip };
  }

  if (store.global >= GLOBAL_LIMIT) {
    return { allowed: false, message: rateLimitMessages.global };
  }

  store.perIp[ip] = ipCount + 1;
  store.global += 1;
  await writeRateStore(store);

  return { allowed: true };
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no esta configurada en el servidor." },
      { status: 500 }
    );
  }

  const ip = getClientIp(request);
  const limit = await enforceRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.message }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const transcriptOverride = formData.get("transcript");
  const messageType = String(formData.get("message_type") ?? "Email");
  const tone = String(formData.get("tone") ?? "Profesional");
  const targetLanguageRaw = String(formData.get("target_language") ?? "Ingles");
  const targetLanguage = targetLanguageRaw.toLowerCase().startsWith("ingl") ? "Ingles" : "Espanol";
  const adjustment = String(formData.get("adjustment") ?? "").trim();

  if (!file && !transcriptOverride) {
    return NextResponse.json(
      { error: "Necesitas grabar o subir un audio." },
      { status: 400 }
    );
  }

  let audioFile: File | null = null;
  if (file instanceof File) {
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "El archivo supera el limite de 20 MB." },
        { status: 413 }
      );
    }

    const ext = getFileExtension(file.name);
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa mp3, m4a, wav, webm u ogg." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    audioFile = await toFile(buffer, file.name || "audio.webm", {
      type: file.type || "audio/webm"
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });

  let transcriptText = "";
  if (typeof transcriptOverride === "string" && transcriptOverride.trim()) {
    transcriptText = transcriptOverride.trim();
  } else if (audioFile) {
    const transcription = await client.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "es"
    });
    transcriptText = transcription.text.trim();
  }

  if (!transcriptText) {
    return NextResponse.json(
      { error: "No se pudo transcribir el audio." },
      { status: 500 }
    );
  }

  const systemPrompt =
    "Eres un asistente bilingue experto en comunicacion profesional. " +
    "Debes convertir ideas habladas en un mensaje claro y listo para enviar, " +
    "manteniendo el tono solicitado. Responde solo en JSON valido.";

  const userPayload = {
    transcript: transcriptText,
    message_type: messageType,
    tone,
    target_language: targetLanguage,
    adjustment
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Convierte el transcript en un mensaje profesional listo para enviar. " +
          "Entrega JSON con las llaves: ready_message, transcript, improvements, better_phrases. " +
          "improvements debe ser una lista de 3 bullets explicando mejoras (claridad, estructura, tono). " +
          "better_phrases debe tener 3 objetos con before y after, en el idioma objetivo. " +
          "Si target_language es Ingles, devuelve ready_message y better_phrases en ingles. " +
          "Si es Espanol, devuelve en espanol. " +
          "Datos: " +
          JSON.stringify(userPayload)
      }
    ],
    temperature: 0.6,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let payload: {
    ready_message?: string;
    transcript?: string;
    improvements?: string[];
    better_phrases?: { before: string; after: string }[];
  } = {};

  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Respuesta inesperada del modelo." },
      { status: 500 }
    );
  }

  const improvements = Array.isArray(payload.improvements)
    ? payload.improvements.map((item) => String(item)).filter(Boolean).slice(0, 3)
    : [];

  const betterPhrases = Array.isArray(payload.better_phrases)
    ? payload.better_phrases
        .map((item) => {
          if (!item) {
            return null;
          }
          if (typeof item === "string") {
            return { before: item, after: "" };
          }
          if (typeof item === "object") {
            const before = String(item.before ?? "");
            const after = String(item.after ?? "");
            if (!before && !after) {
              return null;
            }
            return { before, after };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  return NextResponse.json({
    ready_message: payload.ready_message ?? "",
    transcript: payload.transcript ?? transcriptText,
    improvements,
    better_phrases: betterPhrases
  });
}
