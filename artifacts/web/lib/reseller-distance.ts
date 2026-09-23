export type ResellerPoint = { lat: number; lng: number };

const LAT_LNG = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

function finitePoint(lat: number, lng: number): ResellerPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function pointFromText(value: string) {
  const match = value.trim().match(LAT_LNG);
  if (!match) return null;
  return finitePoint(Number(match[1]), Number(match[2]));
}

function pointFromMapsUrl(mapsUrl: string) {
  const trimmed = mapsUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    for (const key of ["query", "q", "ll"]) {
      const point = pointFromText(url.searchParams.get(key) ?? "");
      if (point) return point;
    }
  } catch {
    return null;
  }
  const at = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!at) return null;
  return finitePoint(Number(at[1]), Number(at[2]));
}

export function resellerPoint(outlet: {
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): ResellerPoint | null {
  if (typeof outlet.latitude === "number" && typeof outlet.longitude === "number") {
    const stored = finitePoint(outlet.latitude, outlet.longitude);
    if (stored) return stored;
  }
  return pointFromMapsUrl(outlet.mapsUrl ?? "");
}
