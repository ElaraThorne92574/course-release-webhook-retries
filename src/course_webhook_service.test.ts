import assert from "node:assert/strict";
import { releaseEvent } from "./course_webhook_service.js";

const valid = { course_id: "course-7", release_id: "release-3", learner_count: 12, diagnostics_url: "https://learn.example/r/3" };
assert.equal(releaseEvent.safeParse(valid).success, true);
assert.equal(releaseEvent.safeParse({ course_id: valid.course_id, release_id: valid.release_id, learner_count: -1, diagnostics_url: valid.diagnostics_url }).success, false);
console.log("release event boundary: valid payload accepted, negative learners rejected");
