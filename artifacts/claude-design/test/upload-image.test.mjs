import assert from "node:assert/strict";
import test from "node:test";
import { uploadMediaAsset } from "../src/upload-image.ts";

test("reports byte progress and WebP processing as distinct stages", async () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;
  const originalWindow = globalThis.window;
  const responses = [
    new Response(JSON.stringify({ assetId: "asset-1", uploadURL: "/upload/asset-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
    new Response(JSON.stringify({
      id: "asset-1",
      originalFilename: "photo.png",
      objectPath: "media/asset-1/image.webp",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ];

  class FakeXMLHttpRequest {
    status = 204;
    responseText = "";
    uploadListeners = {};
    listeners = {};
    upload = {
      addEventListener: (name, listener) => {
        this.uploadListeners[name] = listener;
      },
    };
    open() {}
    setRequestHeader() {}
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }
    send() {
      this.uploadListeners.progress?.({ lengthComputable: true, loaded: 5, total: 10 });
      this.listeners.load?.();
    }
  }

  globalThis.fetch = async () => responses.shift();
  globalThis.XMLHttpRequest = FakeXMLHttpRequest;
  globalThis.window = { dispatchEvent() {} };
  const stages = [];
  try {
    const photo = await uploadMediaAsset(
      new File([new Uint8Array(10)], "photo.png", { type: "image/png" }),
      { onProgress: (progress) => stages.push(progress) },
    );
    assert.equal(photo.assetId, "asset-1");
    assert.deepEqual(stages, [
      { stage: "requesting", percent: 0 },
      { stage: "uploading", percent: 0 },
      { stage: "uploading", percent: 50 },
      { stage: "processing", percent: 100 },
      { stage: "complete", percent: 100 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
    globalThis.window = originalWindow;
  }
});