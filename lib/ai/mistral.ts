declare const process: {
  env: {
    MISTRAL_API_KEY?: string;
    MISTRAL_API_BASE_URL?: string;
    MISTRAL_MODEL_ID?: string;
  };
};

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export class MistralClient {
  private apiKey: string;
  private baseUrl: string;
  private modelId: string;

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY || '';
    this.baseUrl = process.env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1';
    this.modelId = process.env.MISTRAL_MODEL_ID || 'mistral-large-latest';

    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is not defined in environment variables.');
    }
  }

  async createChatCompletion(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Mistral API returned an empty completion choice.');
    }

    return content;
  }
}

export const mistral = new MistralClient();
