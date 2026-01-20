"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  "Escuchando tu audio...",
  "Transcribiendo...",
  "Mejorando el tono...",
  "Dejándolo listo para enviar..."
];

const tips = [
  "Tip: Di el objetivo primero y luego el contexto.",
  "Tip: Cierra con una acción clara.",
  "Tip: Usa frases cortas para ganar claridad.",
  "Tip: Indica tiempos y responsables si aplica."
];

const MAX_FILE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["mp3", "m4a", "wav", "webm", "ogg"];

const messageTypes = ["Email", "Slack", "Mensaje corto"];
const tones = ["Profesional", "Cercano", "Directo"];
const targetLanguages = ["Inglés", "Español"];

type ResultPayload = {
  ready_message: string;
  transcript: string;
  improvements: string[];
  better_phrases: { before: string; after: string }[];
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/ogg"
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

export default function Home() {
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused" | "stopped"
  >("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [messageType, setMessageType] = useState(messageTypes[0]);
  const [tone, setTone] = useState(tones[0]);
  const [targetLanguage, setTargetLanguage] = useState(targetLanguages[0]);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"mensaje" | "transcripcion" | "aprende">(
    "mensaje"
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (recordingState !== "recording") {
      return;
    }
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [recordingState]);

  useEffect(() => {
    if (!loading) {
      return;
    }
    setStepIndex(0);
    setTipIndex(0);
    const stepTimer = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2400);
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3000);
    return () => {
      clearInterval(stepTimer);
      clearInterval(tipTimer);
    };
  }, [loading]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const validateFile = (file: File) => {
    const ext = getFileExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return "Formato no soportado. Usa mp3, m4a, wav, webm u ogg.";
    }
    if (file.size > MAX_FILE_BYTES) {
      return `El archivo supera ${MAX_FILE_MB} MB.`;
    }
    return "";
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setUploadedFile(file);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingState("idle");
  };

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Tu navegador no soporta grabación de audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecordingState("stopped");
        stopStream();
      };

      recorder.start();
      setRecordingTime(0);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setRecordingState("recording");
      setResult(null);
    } catch (err) {
      setError("No pudimos acceder al micrófono. Revisa los permisos del navegador.");
    }
  };

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    if (recordingState === "recording") {
      recorder.pause();
      setRecordingState("paused");
    } else if (recordingState === "paused") {
      recorder.resume();
      setRecordingState("recording");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const resetRecording = () => {
    stopStream();
    setRecordingState("idle");
    setRecordingTime(0);
    setRecordedBlob(null);
    setRecordedUrl(null);
    recorderRef.current = null;
  };

  const buildFormData = (adjustment?: string, useTranscriptOnly?: boolean) => {
    const formData = new FormData();
    if (useTranscriptOnly && result?.transcript) {
      formData.append("transcript", result.transcript);
    } else if (recordedBlob) {
      const ext = recordedBlob.type.includes("ogg") ? "ogg" : "webm";
      const file = new File([recordedBlob], `grabacion.${ext}`, {
        type: recordedBlob.type || "audio/webm"
      });
      formData.append("file", file);
    } else if (uploadedFile) {
      formData.append("file", uploadedFile);
    }

    formData.append("message_type", messageType);
    formData.append("tone", tone);
    formData.append("target_language", targetLanguage);
    if (adjustment) {
      formData.append("adjustment", adjustment);
    }
    return formData;
  };

  const handleGenerate = async (options?: { adjustment?: string; useTranscript?: boolean }) => {
    setError("");
    if (loading) {
      return;
    }

    if (!recordedBlob && !uploadedFile && !(options?.useTranscript && result?.transcript)) {
      setError("Necesitas grabar o subir un audio.");
      return;
    }

    setLoading(true);
    try {
      const formData = buildFormData(options?.adjustment, options?.useTranscript);
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as ResultPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "No se pudo generar el mensaje.");
      }
      setResult(data);
      setActiveTab("mensaje");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.ready_message) {
      return;
    }
    await navigator.clipboard.writeText(result.ready_message);
    setCopied(true);
  };

  const handleDownload = () => {
    if (!result?.ready_message) {
      return;
    }
    const blob = new Blob([result.ready_message], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mensaje.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-speak-blue">
            <div className="floaty grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-card">
              <span className="text-2xl font-bold">S</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">Speak2Send</p>
              <p className="text-sm text-slate-500">Habla natural. Envía profesional.</p>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-speak-ink md:text-4xl">
            Convierte tu voz en un mensaje profesional en inglés.
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Graba o sube un audio en español y obtén un texto listo para enviar, con consejos
            claros para comunicar mejor.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-card">
            3 solicitudes por IP
          </span>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-card">
            20 globales al día
          </span>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "1) Habla en español",
                body: "Exprésate con libertad, sin preocuparte por la gramática."
              },
              {
                title: "2) Pasamos a inglés profesional",
                body: "Reescribimos con un tono claro y listo para el trabajo."
              },
              {
                title: "3) Aprende mejores frases",
                body: "Te mostramos cambios útiles para mejorar tu comunicación."
              }
            ].map((card) => (
              <div key={card.title} className="card border border-white/80">
                <h3 className="text-lg font-semibold text-speak-ink">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{card.body}</p>
              </div>
            ))}
          </div>

          {loading && (
            <div className="card border border-speak-blue/10">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full border-4 border-speak-blue/20 border-t-speak-blue animate-spin" />
                  <div>
                    <p className="text-lg font-semibold text-speak-ink">Procesando tu audio</p>
                    <p className="text-sm text-slate-500">{steps[stepIndex]}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <div key={step} className="flex items-center gap-2 text-sm text-slate-600">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          index <= stepIndex ? "bg-speak-blue" : "bg-slate-200"
                        }`}
                      />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-speak-blue/10 p-4 text-sm text-slate-700">
                  {tips[tipIndex]}
                </div>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="card border border-white/80">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className={`tab-button ${
                      activeTab === "mensaje" ? "tab-button-active" : "tab-button-inactive"
                    }`}
                    onClick={() => setActiveTab("mensaje")}
                  >
                    Mensaje listo
                  </button>
                  <button
                    className={`tab-button ${
                      activeTab === "transcripcion" ? "tab-button-active" : "tab-button-inactive"
                    }`}
                    onClick={() => setActiveTab("transcripcion")}
                  >
                    Transcripción
                  </button>
                  <button
                    className={`tab-button ${
                      activeTab === "aprende" ? "tab-button-active" : "tab-button-inactive"
                    }`}
                    onClick={() => setActiveTab("aprende")}
                  >
                    Aprende
                  </button>
                </div>

                {activeTab === "mensaje" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      {result.ready_message}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-full bg-speak-blue px-5 py-2 text-sm font-semibold text-white shadow-glow"
                        onClick={handleCopy}
                      >
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                      <button
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                        onClick={handleDownload}
                      >
                        Descargar .txt
                      </button>
                      <button
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                        onClick={() => handleGenerate({ useTranscript: true })}
                      >
                        Regenerar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["Más formal", "Más corto", "Más amable"].map((chip) => (
                        <button
                          key={chip}
                          className="chip"
                          onClick={() => handleGenerate({ adjustment: chip, useTranscript: true })}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "transcripcion" && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    {result.transcript}
                  </div>
                )}

                {activeTab === "aprende" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Qué mejoró</h3>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {result.improvements.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-speak-green" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Frases mejores</h3>
                      <div className="mt-3 space-y-3">
                        {result.better_phrases.map((phrase, index) => (
                          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                            <p className="text-slate-500">Antes: {phrase.before}</p>
                            <p className="mt-2 font-semibold text-slate-700">Después: {phrase.after}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card border border-white/80">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Tu audio</h2>
              <p className="mt-2 text-sm text-slate-600">
                Elige grabar desde el navegador o subir un archivo. Tamaño máximo: {MAX_FILE_MB} MB.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  mode === "record"
                    ? "border-speak-blue bg-speak-blue/10 text-speak-blue"
                    : "border-slate-200 text-slate-500"
                }`}
                onClick={() => setMode("record")}
              >
                Grabar
              </button>
              <button
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  mode === "upload"
                    ? "border-speak-blue bg-speak-blue/10 text-speak-blue"
                    : "border-slate-200 text-slate-500"
                }`}
                onClick={() => setMode("upload")}
              >
                Subir audio
              </button>
            </div>

            {mode === "record" && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                  Al iniciar, el navegador te pedirá permiso para el micrófono. Luego explica tu mensaje en español y nosotros hacemos el resto.
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Tiempo</p>
                    <p className="text-lg font-semibold text-slate-700">{formatTime(recordingTime)}</p>
                  </div>
                  {recordingState === "recording" && (
                    <div className="wave" aria-hidden>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {recordingState === "idle" && (
                    <button
                      className="rounded-full bg-speak-blue px-5 py-2 text-sm font-semibold text-white shadow-glow"
                      onClick={startRecording}
                    >
                      Iniciar grabación
                    </button>
                  )}
                  {(recordingState === "recording" || recordingState === "paused") && (
                    <>
                      <button
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                        onClick={togglePause}
                      >
                        {recordingState === "recording" ? "Pausar" : "Reanudar"}
                      </button>
                      <button
                        className="rounded-full bg-speak-orange px-5 py-2 text-sm font-semibold text-white"
                        onClick={stopRecording}
                      >
                        Detener
                      </button>
                    </>
                  )}
                  {recordingState === "stopped" && (
                    <>
                      <button
                        className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                        onClick={resetRecording}
                      >
                        Regrabar
                      </button>
                      <button
                        className="rounded-full bg-speak-blue px-5 py-2 text-sm font-semibold text-white shadow-glow"
                        onClick={() => handleGenerate()}
                      >
                        Usar este audio
                      </button>
                    </>
                  )}
                </div>

                {recordedUrl && (
                  <div className="mt-4">
                    <audio controls src={recordedUrl} className="w-full" />
                  </div>
                )}
              </div>
            )}

            {mode === "upload" && (
              <div
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  dragActive ? "border-speak-blue bg-speak-blue/10" : "border-slate-200 bg-white"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                  }
                }}
              >
                <p className="text-sm text-slate-600">
                  Arrastra tu archivo aquí o selecciona un audio desde tu equipo.
                </p>
                <label className="mt-4 inline-flex cursor-pointer rounded-full bg-speak-blue px-5 py-2 text-sm font-semibold text-white shadow-glow">
                  Elegir archivo
                  <input
                    type="file"
                    className="hidden"
                    accept=".mp3,.m4a,.wav,.webm,.ogg"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                    }}
                  />
                </label>
                {uploadedFile && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">{uploadedFile.name}</p>
                    <p>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4">
              <label className="text-sm font-semibold text-slate-700">
                Tipo de mensaje
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  value={messageType}
                  onChange={(event) => setMessageType(event.target.value)}
                >
                  {messageTypes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Tono
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                >
                  {tones.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Idioma objetivo
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                >
                  {targetLanguages.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              className="rounded-full bg-speak-blue px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => handleGenerate()}
              disabled={loading || (mode === "record" ? !recordedBlob : !uploadedFile)}
            >
              Generar mensaje
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
