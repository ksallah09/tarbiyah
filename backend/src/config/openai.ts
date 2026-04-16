import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

/**
 * Generate a JSON response from OpenAI — used as fallback when Gemini is unavailable.
 */
export async function generateJsonWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model = 'gpt-4o',
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error('OPENAI_API_KEY is not configured.');

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  return completion.choices[0].message.content ?? '';
}
