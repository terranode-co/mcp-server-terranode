import { z } from "zod";
import { TerranodeClient, API_VERSION } from "../client.js";

export const name = "check_location";

export const description =
  "Check which feature in a polygon dataset contains a given coordinate " +
  "(point-in-polygon query). Returns the properties of all matching features, or " +
  "indicates no match. Requires latitude, longitude, and a dataset id (UUID) from " +
  "list_datasets. Call list_datasets first to get the id. This is NOT a geocoder — " +
  "it requires numeric coordinates, not addresses or place names.";

export const inputSchema = {
  lat: z.number().describe("Latitude in decimal degrees (WGS84). Example: 40.7128"),
  lng: z.number().describe("Longitude in decimal degrees (WGS84). Example: -74.0060"),
  dataset: z.string().describe("Dataset id (UUID) from list_datasets"),
};

interface PipResponse {
  match: boolean;
  matches: Array<{
    properties: Record<string, unknown>;
    boundary: boolean;
  }>;
  dataset: string;
  [key: string]: unknown;
}

export async function handler(
  client: TerranodeClient,
  args: { lat: number; lng: number; dataset: string },
) {
  const datasetParam = await client.resolveDataset(args.dataset);
  const raw = (await client.get(
    `/${API_VERSION}/pip`,
    { lat: args.lat, lng: args.lng, ...datasetParam },
    args.dataset,
  )) as PipResponse;

  return {
    match: raw.match,
    dataset: raw.dataset,
    results: raw.matches.map((m) => ({
      properties: m.properties,
      boundary: m.boundary,
    })),
  };
}
