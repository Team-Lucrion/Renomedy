export function deriveProjectedRunoutDate(quantityRemaining: number | null, dailyDepletion: number | null) {
  if (!quantityRemaining || !dailyDepletion || dailyDepletion <= 0) return null;
  const runoutAt = new Date(Date.now() + Math.ceil(quantityRemaining / dailyDepletion) * 24 * 60 * 60 * 1000);
  return runoutAt.toISOString().slice(0, 10);
}

export function deriveContinuityStatus(
  quantityRemaining: number | null,
  dailyDepletion: number | null,
  refillThresholdDays: number
) {
  if (quantityRemaining === null || quantityRemaining === undefined) return "safe";
  if (quantityRemaining <= 0) return "out_of_stock";
  if (!dailyDepletion || dailyDepletion <= 0) return "safe";

  const daysLeft = quantityRemaining / dailyDepletion;
  if (daysLeft <= 1) return "will_run_out";
  if (daysLeft <= refillThresholdDays) return "risk_soon";
  return "safe";
}
