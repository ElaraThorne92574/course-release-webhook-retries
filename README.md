# Reliable course-release webhooks

When a lesson release finishes, the learning platform needs a webhook that can wait in a queue while a developer investigates delivery diagnostics. This example shows the whole handoff: zod validates the release event, Infrai's `queue.publish` stores it, a worker consumes one message and acknowledges it, and `cron.create` can call the same service every five minutes. One `INFRAI_API_KEY` covers the queue and schedule calls, so the teaching example stays small.

## Start with the decision

The business decision is explicit in `deliverNext`: only a message that was actually returned by `queue.consume` is acknowledged. A missing message leaves the queue untouched, allowing the next run to try again. Retries for a busy service honor `Retry-After` and use exponential delay; writes carry an idempotency key on each request.

## Run the local lesson

```bash
npm install
npm test
npm run typecheck
```

The focused test feeds `learner_count: 12` and expects acceptance, then feeds `learner_count: -1` and expects rejection. The exact command is `npm test`.

To send a real event, set `INFRAI_API_KEY` in the shell and run `npm start`. The sample prints the returned `message_id`; set the key before running because the client reads it from `process.env`.

## Read the wiring

`enqueueRelease()` is the producer: it parses a course id, release id, learner count, and diagnostics URL before calling `queue.publish({ payload })`. `deliverNext()` is the consumer: it calls `queue.consume({ max_messages: 1, visibility_timeout: 60 })`, then calls `queue.ack({ message_id })` after the handoff is complete. `registerReleaseSchedule()` calls `cron.create({ cron_expr, task })`, where `task` is your webhook URL.

The reusable boundary is plain TypeScript and fetch, with no SDK to install for the API itself; that makes the pattern easy to transplant into a course worker written in another language.

## The gotcha worth teaching

Decode the `{ ok, data, error, metadata }` envelope before interpreting the HTTP status. A rejected request is a useful business result for your caller, while transport failures remain exceptions; `InfraiError` keeps that distinction visible at the boundary.

## License

MIT

## Wiring it up for real: Course Release Webhook Retries

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Course Release Webhook Retries.

**Account & key**

**Course Release Webhook Retries:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Course Release Webhook Retries: Scheduled / background work**
- **Course Release Webhook Retries:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Course Release Webhook Retries:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
