import { z } from "zod";
import { TerranodeClient, API_VERSION } from "../client.js";

export const name = "spatial_join";

export const description =
  "Enrich a set of coordinates with attributes from a polygon dataset. " +
  "For each point, returns the properties of the polygon it falls within. Like running " +
  "check_location on multiple points at once, but more efficient. Requires an array " +
  "of coordinate objects and a dataset id (UUID) from list_datasets. Call list_datasets " +
  "first to get the id. Points need numeric coordinates, not addresses.";

const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const inputSchema = {
  points: z
    .array(pointSchema)
    .describe(
      'Array of {lat, lng} objects. Optional "properties" on each point are passed through in results. ' +
        "Max 100 points (free tier) or 1000 points (paid tier).",
    ),
  dataset: z.string().describe("Dataset id (UUID) from list_datasets"),
};

interface SpatialJoinResult {
  index: number;
  input: Record<string, unknown>;
  joined: boolean;
  matches: Array<{
    properties: Record<string, unknown>;
  }>;
}

interface SpatialJoinResponse {
  dataset: string;
  results: SpatialJoinResult[];
  [key: string]: unknown;
}

export async function handler(
  client: TerranodeClient,
  args: {
    points: Array<{ lat: number; lng: number; properties?: Record<string, unknown> }>;
    dataset: string;
  },
) {
  // The spatial-join API takes an array of point objects in the body
  // and the dataset as a query parameter
  const body = args.points.map((p) => {
    const point: Record<string, unknown> = { lat: p.lat, lng: p.lng };
    if (p.properties) {
      Object.assign(point, p.properties);
    }
    return point;
  });

  const datasetParam = await client.resolveDataset(args.dataset);
  const raw = (await client.post(
    `/${API_VERSION}/spatial-join`,
    body,
    datasetParam,
    args.dataset,
  )) as SpatialJoinResponse;

  return {
    dataset: raw.dataset,
    results: raw.results.map((r) => {
      const point = args.points[r.index];
      if (!point) {
        return { point: { lat: 0, lng: 0 }, match: false, properties: null };
      }
      return {
        point: { lat: point.lat, lng: point.lng },
        match: r.joined,
        properties: r.joined && r.matches.length > 0 ? r.matches[0].properties : null,
      };
    }),
  };
}
