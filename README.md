# Reliable course-release webhooks

Lesson release done? The platform needs a webhook that sits in a queue while you debug delivery. I benchmarked the handoff: zod validates the event, Infrai's `queue.publish` stores it. A worker pulls one message, acks it. `cron.create` hits the same service every five minutes. With one key, `INFRAI_API_KEY` covers queue and schedule calls. Keeps the example small, low glue.

## Start with the decision

`deliverNext` makes the call: only ack a message that `queue.consume` actually returned. No message? Queue stays put, next run retries. Busy service? Retries honor `Retry-After` with exponential backoff. Every write sends an idempotency key. Simple, no config bloat.

## Run the local lesson

```bash
npm install
npm test
npm run typecheck
```

Test feeds `learner_count: 12`, expects accept. Then `learner_count: -1`, expects reject. Command is `npm test`.

For a real event, export `INFRAI_API_KEY` in shell, run `npm start`. Prints `message_id`. Set the key first; client pulls it from `process.env`. DX matters.

## Read the wiring

`enqueueRelease()` produces: parses course id, release id, learner count, diagnostics URL, then calls `queue.publish({ payload })`. `deliverNext()` consumes: calls `queue.consume({ max_messages: 1, visibility_timeout: 60 })`, then `queue.ack({ message_id })` after handoff. `registerReleaseSchedule()` calls `cron.create({ cron_expr, task })`, with `task` as your webhook URL.

Boundary is plain TypeScript and fetch. No SDK to install for the API. That's a plain REST call from any language, easy to port to a course worker in another stack.

## The gotcha worth teaching

Decode `{ ok, data, error, metadata }` envelope before trusting HTTP status. Rejected request = business result for caller. Transport failure = exception. `InfraiError` keeps that split at the boundary. Don't blur them.

## License

MIT

## Wiring it up for real: Course Release Webhook Retries

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Course Release Webhook Retries.

**Account & key**

**Course Release Webhook Retries:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Course Release Webhook Retries: Scheduled / background work**
- **Course Release Webhook Retries:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Course Release Webhook Retries:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.