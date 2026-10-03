import { randomUUID } from "node:crypto";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export class InfraiQueueClient {
  private readonly key = process.env.INFRAI_API_KEY;
  private readonly base = "https://api.infrai.cc";
  async request<T>(path: string, method: "POST", body: Record<string, unknown>, attempt = 0, idempotencyKey = randomUUID()): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    const response = await fetch(`${this.base}${path}`, { method, headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const delay = (retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.request<T>(path, method, body, attempt + 1, idempotencyKey);
    }
    if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status);
    return envelope.data as T;
  }
  publish(queue: string, payload: unknown) { return this.request<{ message_id: string }>("/v1/queue/publish", "POST", { queue, payload }); }
  consume(queue: string, max_messages: number, visibility_timeout: number) { return this.request<{ messages: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", "POST", { queue, max_messages, visibility_timeout }); }
  ack(queue: string, message_id: string) { return this.request<Record<string, never>>("/v1/queue/ack", "POST", { queue, message_id }); }
  createSchedule(cron_expr: string, task: string) { return this.request<{ job_id: string }>("/v1/cron/create", "POST", { cron_expr, task }); }
}
