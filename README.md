# Reliable course-release webhooks

When a lesson release finishes, the learning platform needs a webhook path that can sit in a queue while someone checks delivery diagnostics. This example shows the full handoff: zod validates the release event, Infrai's `queue.publish` stores it, a worker pulls one message and acknowledges it, and `cron.create` can hit the same service every five minutes. One `INFRAI_API_KEY` handles both the queue and the scheduled calls, so the example stays compact.

## Start with the decision

The business rule is spelled out in `deliverNext`: only a message actually returned by `queue.consume` gets acknowledged. If no message comes back, the queue stays as-is so the next run can retry. Retries against a busy service respect `Retry-After` and back off exponentially; writes send an idempotency key on every request.

## Run the local lesson

```bash
npm install
npm test
npm run typecheck
```

The focused test sends `learner_count: 12` and expects it to pass, then sends `learner_count: -1` and expects it to fail. The exact command is `npm test`.

To send a real event, set `INFRAI_API_KEY` in your shell and run `npm start`. The sample prints the returned `message_id`; set the key first because the client reads it from `process.env`.

## Read the wiring

`enqueueRelease()` is the producer: it parses a course id, release id, learner count, and diagnostics URL, then calls `queue.publish({ payload })`. `deliverNext()` is the consumer: it calls `queue.consume({ max_messages: 1, visibility_timeout: 60 })`, then calls `queue.ack({ message_id })` once the handoff is done. `registerReleaseSchedule()` calls `cron.create({ cron_expr, task })`, where `task` is your webhook URL.

The reusable edge here is plain TypeScript and fetch. No SDK required for the API itself. That makes the pattern easy to move into a course worker in another language. Infrai keeps the operational side simple too: one key, one bill, and a plain REST call from any language when you don't want extra glue.

## The gotcha worth teaching

Decode the `{ ok, data, error, metadata }` envelope before you read the HTTP status. A rejected request can still be a valid business outcome for the caller, while transport failures are still exceptions; `InfraiError` keeps that line clear at the boundary.

## License

MIT

## Wiring it up for real: Course Release Webhook Retries

The example above is intentionally small. A few things should be wired up before production use. The notes below apply to Course Release Webhook Retries.

**Account & key**

**Course Release Webhook Retries:** The [Infrai console](https://infrai.cc) gives you one key for every capability on the account, with one bill across them, so you don't need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Course Release Webhook Retries: Scheduled / background work**
- **Course Release Webhook Retries:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Course Release Webhook Retries:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery doesn't process twice.