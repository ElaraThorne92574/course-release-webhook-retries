import { z } from "zod";
import { InfraiError, InfraiQueueClient } from "./infrai_queue_client.js";

export const releaseEvent = z.object({ course_id: z.string().min(1), release_id: z.string().min(1), learner_count: z.number().int().nonnegative(), diagnostics_url: z.string().url() });
export type ReleaseEvent = z.infer<typeof releaseEvent>;
const releaseQueue = "course-release-webhooks";

export async function enqueueRelease(input: unknown, queue = new InfraiQueueClient()) {
  const event = releaseEvent.parse(input);
  return queue.publish(releaseQueue, { type: "course.release.ready", event });
}

export async function deliverNext(queue = new InfraiQueueClient()) {
  const batch = await queue.consume(releaseQueue, 1, 60);
  const message = batch.messages[0];
  if (!message) return { delivered: false };
  await queue.ack(releaseQueue, message.message_id);
  return { delivered: true, message_id: message.message_id, payload: message.payload };
}

export async function registerReleaseSchedule(webhookUrl: string, queue = new InfraiQueueClient()) {
  if (!z.string().url().safeParse(webhookUrl).success) throw new Error("webhookUrl must be a URL");
  return queue.createSchedule("*/5 * * * *", webhookUrl);
}

if (process.argv[1]?.endsWith("course_webhook_service.ts")) {
  const event = { course_id: "typescript-101", release_id: "week-4", learner_count: 42, diagnostics_url: "https://learn.example/diagnostics/week-4" };
  enqueueRelease(event).then(result => console.log(JSON.stringify({ queued: true, message_id: result.message_id }))).catch((error: unknown) => {
    if (error instanceof InfraiError) console.error(`Infrai rejected the request (${error.code})`); else console.error(error);
    process.exitCode = 1;
  });
}
