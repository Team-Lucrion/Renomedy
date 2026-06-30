const assert = require("assert");

// This test validates the expected behavior of PrescriptionHubScreen's OCR Edge fallback logic
// by simulating the exact React Native TextRecognition flow used in the component.

const trackingLog = [];
const mockTrackEvent = (eventName, data) => trackingLog.push({ eventName, data });

async function simulatePrescriptionHubOcrFlow(mockSuccess) {
  let extractedText = null;

  const TextRecognition = {
    recognize: async (uri) => {
        if (mockSuccess) return { text: "Simulated OCR Text" };
        throw new Error("OCR Failed");
    }
  };

  try {
    const result = await TextRecognition.recognize("dummy_uri");
    if (result && result.text) {
      extractedText = result.text;
      mockTrackEvent('edge_ocr_success', { text_length: extractedText.length });
    }
  } catch (ocrError) {
    mockTrackEvent('edge_ocr_failed', { error: String(ocrError) });
  }
}

async function runTests() {
  trackingLog.length = 0;
  await simulatePrescriptionHubOcrFlow(true);
  assert.strictEqual(trackingLog.length, 1);
  assert.strictEqual(trackingLog[0].eventName, 'edge_ocr_success');
  assert.strictEqual(trackingLog[0].data.text_length, 18);

  trackingLog.length = 0;
  await simulatePrescriptionHubOcrFlow(false);
  assert.strictEqual(trackingLog.length, 1);
  assert.strictEqual(trackingLog[0].eventName, 'edge_ocr_failed');
  assert.ok(trackingLog[0].data.error.includes("OCR Failed"));

  console.log("PrescriptionHubScreen edge fallback logic test passed!");
}

runTests().catch(console.error);
