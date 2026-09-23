import assert from "node:assert/strict";
import test from "node:test";
import { resellerPoint } from "./reseller-distance.ts";

test("resellerPoint prefers stored coordinates over the Google pin", () => {
  const point = resellerPoint({
    latitude: -33.3512,
    longitude: 117.1234,
    mapsUrl: "https://maps.app.goo.gl/example",
  });
  assert.deepEqual(point, { lat: -33.3512, lng: 117.1234 });
});

test("resellerPoint reads coordinates embedded in a Google Maps URL", () => {
  assert.deepEqual(
    resellerPoint({ mapsUrl: "https://www.google.com/maps/search/?api=1&query=-33.3512,117.1234", latitude: null, longitude: null }),
    { lat: -33.3512, lng: 117.1234 },
  );
  assert.deepEqual(
    resellerPoint({ mapsUrl: "https://www.google.com/maps/place/Katanning/@-33.689,117.555,14z", latitude: null, longitude: null }),
    { lat: -33.689, lng: 117.555 },
  );
});

test("resellerPoint ignores short pins that do not contain coordinates", () => {
  assert.equal(resellerPoint({ mapsUrl: "https://maps.app.goo.gl/example", latitude: null, longitude: null }), null);
});
