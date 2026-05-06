const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAlertDedupeKey } = require("../dist/services/notification/alert.utils.js");

test("buildAlertDedupeKey joins meaningful parts only", () => {
  assert.equal(buildAlertDedupeKey(["due-dose", "schedule-1", "", null, "user-1"]), "due-dose:schedule-1:user-1");
});
