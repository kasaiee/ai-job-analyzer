// Catalog of AI providers selectable in Settings. Ids match the backend
// registry in chat/services/providers.py.
export const AI_PROVIDERS = [
  { id: 'custom', label: 'Custom (OpenAI-compatible)', baseUrl: '', requiresKey: true },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', requiresKey: true },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    requiresKey: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    requiresKey: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
  },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', requiresKey: true },
  { id: 'mistral', label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', requiresKey: true },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', requiresKey: true },
  { id: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', requiresKey: true },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
  },
];

export const DEFAULT_PROVIDER = 'custom';

export const getProvider = (id) => AI_PROVIDERS.find((provider) => provider.id === id);
