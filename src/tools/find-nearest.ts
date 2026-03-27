import { z } from "zod";
import { TerranodeClient, API_VERSION } from "../client.js";

export const name = "find_nearest";

export const description =
  "Find the nearest counties, districts, ZIP codes, or other features to a coordinate. " +
  "Use this for proximity queries, finding what's nearby, or ranking features by distance. " +
  "Returns features sorted by distance (meters and miles), measured to feature boundary. " +
  "Also works as a reverse lookup — returns the containing feature (distance=0) plus neighbors. " +
  "Requires latitude, longitude, and a dataset id (UUID) from list_datasets.";

export const inputSchema = {
  lat: z.number().describe("Latitude in decimal degrees (WGS84)"),
  lng: z.number().describe("Longitude in decimal degrees (WGS84)"),
  dataset: z.string().describe("Dataset id (UUID) from list_datasets"),
  n: z
    .number()
    .int()
    .optional()
    .describe("Number of nearest features to return (max 20, default 1)"),
  radius: z.number().optional().describe("Maximum search radius in meters (max 500000)"),
};

interface NearestResponse {
  matches: Array<{
    properties: Record<string, unknown>;
    within: boolean;
    distance_m: number;
    distance_mi: number;
  }>;
  dataset: string;
  [key: string]: unknown;
}

export async function handler(
  client: TerranodeClient,
  args: { lat: number; lng: number; dataset: string; n?: number; radius?: number },
) {
  const datasetParam = await client.resolveDataset(args.dataset);
  const raw = (await client.get(
    `/${API_VERSION}/nearest`,
    { lat: args.lat, lng: args.lng, ...datasetParam, n: args.n, radius: args.radius },
    args.dataset,
  )) as NearestResponse;

  return {
    dataset: raw.dataset,
    results: raw.matches.map((m) => ({
      properties: m.properties,
      within: m.within,
      distance_m: m.distance_m,
      distance_mi: m.distance_mi,
    })),
  };
}
