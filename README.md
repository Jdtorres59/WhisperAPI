# Speak2Send

**Habla natural. Envía profesional.**

Speak2Send transforma notas de voz en español en un mensaje profesional listo para enviar en inglés (o español), con un enfoque educativo para mejorar la comunicación.

## Qué hace
- Transcribe audio en español con Whisper.
- Reescribe el mensaje con el tono y formato adecuados (email, Slack o mensaje corto).
- Entrega mejoras y frases sugeridas para aprender.

## Requisitos
- Node.js 18+
- Variable de entorno `OPENAI_API_KEY`

## Ejecutar en local

```bash
npm install
export OPENAI_API_KEY="tu_api_key"
npm run dev
```

Abre `http://localhost:3000`.

## Endpoints
- `POST /api/convert` (multipart/form-data)
  - `file` (mp3, m4a, wav, webm, ogg)
  - `message_type` (Email, Slack, Mensaje corto)
  - `tone` (Profesional, Cercano, Directo)
  - `target_language` (Inglés, Español)
  - `adjustment` (opcional: "Más formal", "Más corto", "Más amable")

## Rate limits (demo)
- 3 solicitudes por IP y por día
- 20 solicitudes globales por día

Los límites se almacenan en un archivo temporal (`/tmp`) para mantener la demo simple.

## Despliegue en Vercel
1. Sube el repo a GitHub.
2. Crea un nuevo proyecto en Vercel y selecciona el repo.
3. Configura la variable `OPENAI_API_KEY`.
4. Deploy.

Vercel detecta Next.js automáticamente.

---

Hecho para españoles que necesitan enviar mensajes en inglés con confianza y claridad.
