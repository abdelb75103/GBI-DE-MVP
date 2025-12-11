import { GoogleGenerativeAI } from '@google/generative-ai';

const PRIMARY_MODEL_NAME = 'gemini-2.5-flash';
const FALLBACK_MODEL_NAME = 'gemini-2.5-flash-lite';

type ModelCacheKey = string;

const modelCache = new Map<ModelCacheKey, ReturnType<GoogleGenerativeAI['getGenerativeModel']>>();

export function createGeminiModel(apiKey: string, modelName: string = PRIMARY_MODEL_NAME) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('Gemini API key is required');
  }

  const cacheKey: ModelCacheKey = `${trimmed}:${modelName}`;
  const cached = modelCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = new GoogleGenerativeAI(trimmed);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 32,
      responseMimeType: 'application/json',
    },
  });

  modelCache.set(cacheKey, model);
  return model;
}

export function getModelName() {
  return PRIMARY_MODEL_NAME;
}

export function getFallbackModelName() {
  return FALLBACK_MODEL_NAME;
}
