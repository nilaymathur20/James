import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// The dev server and Cloud Run app-container must strictly listen on port 3000
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint for container probes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Initialize GoogleGenAI client with server API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SUPPORTED_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: 'Recommended',
    description: 'Multimodal intelligence for text, coding, video & audio with reasoning support',
    maxContextTokens: 1048576,
    defaultMaxOutputTokens: 4096,
    speed: 'Ultra Fast',
    reasoningSupport: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Turbo',
    description: 'Ultra-low latency, optimized for rapid back-and-forth dialogue & light tasks',
    maxContextTokens: 1048576,
    defaultMaxOutputTokens: 4096,
    speed: 'Instantaneous',
    reasoningSupport: false,
  },
];

// Helper to format messages into Gemini SDK Contents
function formatContents(messages: any[]) {
  return messages.map((msg) => {
    const parts: any[] = [];

    // Add attachments (images, video, audio, code, documents)
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        const isMedia =
          att.mimeType &&
          (att.mimeType.startsWith('image/') ||
            att.mimeType.startsWith('video/') ||
            att.mimeType.startsWith('audio/'));

        if (isMedia) {
          const rawBase64 = att.data.includes('base64,')
            ? att.data.split('base64,')[1]
            : att.data;
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: rawBase64,
            },
          });
        } else if (att.data) {
          parts.push({
            text: `[Attached File: ${att.name || 'document'}]\n${att.data}\n[End of ${att.name || 'document'}]`,
          });
        }
      }
    }

    if (msg.content && msg.content.trim()) {
      parts.push({ text: msg.content });
    }

    // Gemini requires at least one part
    if (parts.length === 0) {
      parts.push({ text: ' ' });
    }

    const role = msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts,
    };
  });
}

// Model list endpoint
app.get('/api/models', (_req, res) => {
  res.json({ models: SUPPORTED_MODELS });
});

// Count tokens endpoint
app.post('/api/tokens/count', async (req, res) => {
  try {
    const { messages = [], systemInstruction, model = 'gemini-3.8-flash' } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      const fullText = (systemInstruction || '') + ' ' + messages.map((m: any) => m.content || '').join(' ');
      const estimated = Math.max(1, Math.ceil(fullText.length / 4));
      return res.json({ totalTokens: estimated, estimated: true });
    }

    const contents = formatContents(messages);
    const countConfig: any = {};
    if (systemInstruction) {
      countConfig.systemInstruction = systemInstruction;
    }

    const result = await ai.models.countTokens({
      model,
      contents,
      config: countConfig,
    });

    res.json({ totalTokens: result.totalTokens, estimated: false });
  } catch (error: any) {
    const { messages = [], systemInstruction } = req.body;
    const fullText = (systemInstruction || '') + ' ' + messages.map((m: any) => m.content || '').join(' ');
    const estimated = Math.max(1, Math.ceil(fullText.length / 4));
    res.json({ totalTokens: estimated, estimated: true, error: error.message });
  }
});

// Video & Audio Transcription endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    const { data, mimeType, filename = 'recording', customPrompt } = req.body;

    if (!data || !mimeType) {
      return res.status(400).json({ error: 'Media data and mimeType are required.' });
    }

    const rawBase64 = data.includes('base64,') ? data.split('base64,')[1] : data;

    const mediaPart = {
      inlineData: {
        mimeType,
        data: rawBase64,
      },
    };

    const promptText =
      customPrompt ||
      `Please transcribe this video/audio recording with high accuracy.
Include:
1. Complete timestamped transcription format: [mm:ss] Speaker: text
2. Speaker identification (e.g. Speaker 1, Speaker 2)
3. Concise Executive Summary (3-5 bullet points)
4. Key Action Items & Mentions

Be thorough, precise, and preserve technical terms.`;

    const textPart = { text: promptText };

    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [mediaPart, textPart] },
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const durationMs = Date.now() - startTime;
    const transcriptText = response.text || 'No transcription generated.';

    res.json({
      success: true,
      filename,
      mimeType,
      durationMs,
      transcript: transcriptText,
      usageMetadata: response.usageMetadata || null,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: error.message || 'Failed to transcribe media file.',
    });
  }
});

// Streaming Chat Completion endpoint via Server-Sent Events (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const {
    messages = [],
    model = 'gemini-3.8-flash',
    systemInstruction,
    temperature = 0.7,
    topP = 0.95,
    maxOutputTokens = 4096,
    enableThinking = false,
    thinkingBudget = 2048,
  } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required and cannot be empty.' });
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startTime = Date.now();
  let generatedTokensEstimated = 0;

  try {
    const contents = formatContents(messages);

    const config: any = {
      temperature: Math.max(0, Math.min(2, Number(temperature))),
      topP: Math.max(0, Math.min(1, Number(topP))),
    };

    if (systemInstruction && systemInstruction.trim()) {
      config.systemInstruction = systemInstruction.trim();
    }

    if (maxOutputTokens && Number(maxOutputTokens) > 0) {
      config.maxOutputTokens = Number(maxOutputTokens);
    }

    // Enable thinking configuration if requested on supported models
    if (enableThinking && model === 'gemini-3.8-flash') {
      config.thinkingConfig = {
        thinkingBudget: Math.min(8192, Math.max(512, Number(thinkingBudget) || 2048)),
      };
    }

    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config,
    });

    let finalUsageMetadata: any = null;

    for await (const chunk of responseStream) {
      // Check for reasoning / thought parts
      let thoughtText = '';
      const candidate = chunk.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if ((part as any).thought) {
            thoughtText += (part as any).text || '';
          }
        }
      }

      const text = chunk.text || '';
      generatedTokensEstimated += Math.max(1, Math.ceil((text + thoughtText).length / 4));

      if (chunk.usageMetadata) {
        finalUsageMetadata = chunk.usageMetadata;
      }

      sendEvent({
        text,
        thoughtText: thoughtText || undefined,
        usageMetadata: chunk.usageMetadata || null,
      });
    }

    const durationMs = Date.now() - startTime;
    const promptTokens = finalUsageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(contents).length / 4);
    const candidatesTokens = finalUsageMetadata?.candidatesTokenCount || generatedTokensEstimated;
    const totalTokens = finalUsageMetadata?.totalTokenCount || (promptTokens + candidatesTokens);

    sendEvent({
      done: true,
      stats: {
        durationMs,
        promptTokens,
        candidatesTokens,
        totalTokens,
        tokensPerSecond: durationMs > 0 ? ((candidatesTokens / durationMs) * 1000).toFixed(1) : '0',
      },
    });

    res.end();
  } catch (error: any) {
    console.error('Error during chat generation:', error);
    sendEvent({
      error: error.message || 'An error occurred during response generation.',
      done: true,
    });
    res.end();
  }
});

// Mount Vite in dev or static files in production
async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const indexHtml = path.resolve(distDir, 'index.html');
  const hasDist = fs.existsSync(indexHtml);

  if (process.env.NODE_ENV === 'production' || hasDist) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[JAMES Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
