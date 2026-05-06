const test = require("node:test");
const assert = require("node:assert/strict");

const {
  deriveContinuityStatus,
  deriveProjectedRunoutDate
} = require("../dist/modules/medications/refill.utils.js");

test("deriveContinuityStatus returns safe when inventory is healthy", () => {
  assert.equal(deriveContinuityStatus(30, 1, 3), "safe");
});

test("deriveContinuityStatus returns risk states near runout", () => {
  assert.equal(deriveContinuityStatus(2, 1, 3), "risk_soon");
  assert.equal(deriveContinuityStatus(1, 1, 3), "will_run_out");
  assert.equal(deriveContinuityStatus(0, 1, 3), "out_of_stock");
});

test("deriveProjectedRunoutDate returns an ISO date string when depletion is known", () => {
  const result = deriveProjectedRunoutDate(10, 2);
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});
