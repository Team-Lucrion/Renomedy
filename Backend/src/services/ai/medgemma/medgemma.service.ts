import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { MEDGEMMA_SYSTEM_PROMPT, buildMedGemmaExtractionPrompt, MEDGEMMA_PROMPT_VERSION } from "./medgemma.prompts";
import { parseMedGemmaResponse, MedGemmaPrescriptionPayload } from "./medgemma.validation";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export class MedGemmaService {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor() {
    this.endpoint = env.MEDGEMMA_ENDPOINT;
    this.model = env.MEDGEMMA_MODEL;
    this.timeoutMs = env.MEDGEMMA_TIMEOUT_MS;
    this.retryCount = env.MEDGEMMA_RETRY_COUNT;
    this.maxTokens = env.MEDGEMMA_MAX_TOKENS;
    this.temperature = env.MEDGEMMA_TEMPERATURE;
  }

  async extractMedicines(ocrText: string): Promise<{ payload: MedGemmaPrescriptionPayload; rawResponse: string }> {
    const messages: ChatMessage[] = [
      { role: "system", content: MEDGEMMA_SYSTEM_PROMPT },
      { role: "user", content: buildMedGemmaExtractionPrompt(ocrText) },
    ];

    const requestBody: ChatCompletionRequest = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      // Provide a hint for JSON output format, assuming the underlying OpenAI-compatible endpoint supports it
      response_format: { type: "json_object" },
    };

    let attempt = 0;
    let lastError: Error | unknown;

    while (attempt <= this.retryCount) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(requestBody);
        const latency = Date.now() - startTime;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - ${await response.text().catch(() => "")}`);
        }

        const data = await response.json();

        // Handle OpenAI format response
        const rawResponseContent = data.choices?.[0]?.message?.content || "";

        if (!rawResponseContent) {
          throw new Error("Empty response from MedGemma model");
        }

        logger.info({
          model: this.model,
          latencyMs: latency,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          attempt: attempt + 1,
          promptVersion: MEDGEMMA_PROMPT_VERSION
        }, "MedGemma inference successful");

        const payload = parseMedGemmaResponse(rawResponseContent);

        return { payload, rawResponse: rawResponseContent };
      } catch (error) {
        lastError = error;
        attempt++;

        logger.warn({
          error: error instanceof Error ? error.message : "Unknown error",
          attempt,
          maxRetries: this.retryCount
        }, "MedGemma inference attempt failed");

        if (attempt <= this.retryCount) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    logger.error({ error: lastError }, "MedGemma inference failed after all retries");
    throw new Error(`MedGemma inference failed: ${lastError instanceof Error ? lastError.message : "Unknown error"}`);
  }

  private async makeRequest(body: ChatCompletionRequest): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(id);
    }
  }
}
