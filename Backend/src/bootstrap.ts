import { initSentry } from "./lib/sentry";

let bootstrapped = false;

export function bootstrapApp() {
  if (bootstrapped) {
    return;
  }

  initSentry();
  bootstrapped = true;
}
