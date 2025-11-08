import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-2.0-flash';

type ModelCacheKey = string;

const modelCache = new Map<ModelCacheKey, ReturnType<GoogleGenerativeAI['getGenerativeModel']>>();

export function createGeminiModel(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('Gemini API key is required');
  }

  const cached = modelCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const client = new GoogleGenerativeAI(trimmed);
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 32,
      responseMimeType: 'application/json',
    },
  });

  modelCache.set(trimmed, model);
  return model;
}

export function getModelName() {
  return MODEL_NAME;
}
