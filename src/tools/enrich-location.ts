import { z } from "zod";
import { TerranodeClient, API_VERSION } from "../client.js";

export const name = "enrich_location";

export const description =
  "Get location attributes (county, flood zone, school district, etc.) for a coordinate. " +
  "Queries all available datasets in one call and returns what matched. No dataset id needed — " +
  "this is the simplest way to find out what's at a location. Optional radius expands the search " +
  "area (meters). This is NOT a geocoder — it requires numeric coordinates, not addresses or " +
  "place names.";

export const inputSchema = {
  lat: z
    .number()
    .describe("Latitude in decimal degrees (WGS84). Example: 40.7128"),
  lng: z
    .number()
    .describe("Longitude in decimal degrees (WGS84). Example: -74.0060"),
  radius: z
    .number()
    .optional()
    .describe(
      "Expand search area by this radius in meters (max 500000). Omit for exact matches.",
    ),
};

interface EnrichResponse {
  summary: {
    datasets_queried: number;
    datasets_matched: number;
    requests_charged: number;
  };
  results: Array<{
    dataset: string;
    type: "system" | "user";
    version: number;
    match: boolean;
    intersections: Array<{
      properties: Record<string, unknown>;
      on_boundary: boolean;
      distance_m: number;
      distance_mi: number;
    }>;
  }>;
  errors: Array<{
    dataset: string;
    type: "system" | "user";
    error: string;
  }>;
  [key: string]: unknown;
}

export async function handler(
  client: TerranodeClient,
  args: { lat: number; lng: number; radius?: number },
) {
  const params: Record<string, string | number | undefined> = {
    lat: args.lat,
    lng: args.lng,
  };
  if (args.radius !== undefined && args.radius > 0) {
    params.radius = args.radius;
  }

  const raw = (await client.get(
    `/${API_VERSION}/enrich`,
    params,
  )) as EnrichResponse;

  return {
    summary: raw.summary,
    results: raw.results.map((r) => ({
      dataset: r.dataset,
      type: r.type,
      match: r.match,
      intersections: r.intersections,
    })),
    errors: raw.errors,
  };
}
