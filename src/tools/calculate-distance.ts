import { z } from "zod";
import { TerranodeClient, API_VERSION } from "../client.js";

export const name = "calculate_distance";

export const description =
  "Calculate the exact geodesic distance between two points on Earth's " +
  "surface. Uses the WGS84 ellipsoid model for high accuracy. No dataset needed. " +
  "Returns distance in both meters and miles.";

export const inputSchema = {
  lat1: z.number().describe("Latitude of first point"),
  lng1: z.number().describe("Longitude of first point"),
  lat2: z.number().describe("Latitude of second point"),
  lng2: z.number().describe("Longitude of second point"),
};

interface DistanceResponse {
  distance_m: number;
  distance_mi: number;
  [key: string]: unknown;
}

export async function handler(
  client: TerranodeClient,
  args: { lat1: number; lng1: number; lat2: number; lng2: number },
) {
  const raw = (await client.get(`/${API_VERSION}/distance`, {
    lat1: args.lat1,
    lng1: args.lng1,
    lat2: args.lat2,
    lng2: args.lng2,
  })) as DistanceResponse;

  return {
    distance_m: raw.distance_m,
    distance_mi: raw.distance_mi,
  };
}
