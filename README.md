# Pulse CRM

CRM personal para call center construido con `Next.js 16`, `Supabase Auth`, `Supabase Postgres`, `react-hook-form` y `zod`.

## Requisitos

- Node.js 24+
- Un proyecto de Supabase activo

## Configuración rápida

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea tu archivo `.env.local` desde `.env.example`.

3. En Supabase:
   - Ejecuta el contenido de `supabase/schema.sql`.
   - En `Authentication > Providers > Email`, desactiva la confirmación de correo.
   - Crea tus usuarios manualmente desde `Authentication > Users`.

4. Inicia la app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: entorno local
- `npm run build`: build de producción
- `npm run lint`: linting
- `npm run test`: pruebas unitarias

## Qué incluye esta v1

- Login por email y contraseña con Supabase Auth
- Dashboard con métricas rápidas
- Alta y edición de casos
- Módulo de seguimiento de venta con número, SEC, recojo/delivery y fecha
- Filtros por búsqueda, estado, producto y agenda
- Ajustes con subida de diagramas y chat interno sobre documentos
- Aislamiento por usuario con RLS

## Diagramas y chat interno

El módulo de `Ajustes > Diagramas` permite:

- Subir PDFs, imágenes (`png`, `jpg`, `webp`) y archivos de texto
- Subir también libros de Excel (`xlsx`, `xlsm`)
- Procesar el contenido del documento por usuario
- Consultar un chat interno sobre contrato, validaciones, pasos y objeciones

### Configuración extra

1. Asegúrate de ejecutar la versión actual de `supabase/schema.sql` para crear:
   - tablas `knowledge_documents` y `knowledge_chunks`
   - bucket privado `knowledge-documents`
   - políticas RLS para documentos y storage

2. Agrega estas variables a `.env.local`:

   ```bash
   GROQ_API_KEY=tu_api_key
   GROQ_TEXT_MODEL=openai/gpt-oss-20b
   GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
   ```

### Notas del MVP

- PDF: se indexa desde texto extraído.
- XLSX/XLSM: se indexan hojas y celdas del libro.
- Imagen: se resume con visión usando Groq antes de indexarse.
- Si el diagrama dentro de Excel está hecho con formas, flechas o SmartArt, conviene exportarlo a PDF para no perder estructura visual.
- El chat responde solo con los diagramas cargados por el usuario autenticado.

## Despliegue en Vercel

- Sube el repo a GitHub.
- Crea un proyecto en Vercel.
- Configura las mismas variables `NEXT_PUBLIC_*`.
- Deploy.
