import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { resolvePrescriptionScanFile } from "../dist/modules/prescriptions/prescriptions.service.js";

describe("SSRF Protection", () => {
  it("rejects localhost URLs", async () => {
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://localhost/image.png" } }),
      /Could not fetch image from the provided URL/
    );
  });

  it("rejects 127.0.0.1 URLs", async () => {
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://127.0.0.1/image.png" } }),
      /Could not fetch image from the provided URL/
    );
  });

  it("rejects RFC1918 private IPv4 addresses", async () => {
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://192.168.1.1/image.png" } }),
      /Could not fetch image from the provided URL/
    );
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://10.0.0.1/image.png" } }),
      /Could not fetch image from the provided URL/
    );
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://172.16.0.1/image.png" } }),
      /Could not fetch image from the provided URL/
    );
  });

  it("rejects IPv6 local/private addresses", async () => {
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "https://[::1]/image.png" } }),
      /Could not fetch image from the provided URL/
    );
  });

  it("rejects malformed URLs", async () => {
    await assert.rejects(
      async () => await resolvePrescriptionScanFile({ body: { imageUrl: "not-a-url" } }),
      /Invalid imageUrl/
    );
  });
});
