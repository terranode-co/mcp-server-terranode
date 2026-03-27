import { describe, it, expect, vi } from "vitest";
import { TerranodeClient } from "../../src/client.js";
import { handler } from "../../src/tools/calculate-distance.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn(),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("calculate_distance", () => {
  it("returns shaped distance result", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        distance_m: 5570230.12,
        distance_mi: 3461.05,
        api_version: "1.0",
        latency_ms: 1,
      }),
    });

    const result = await handler(client, {
      lat1: 40.7128,
      lng1: -74.006,
      lat2: 34.0522,
      lng2: -118.2437,
    });

    expect(result).toEqual({
      distance_m: 5570230.12,
      distance_mi: 3461.05,
    });
  });

  it("strips metadata from response", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        distance_m: 100,
        distance_mi: 0.062,
        api_version: "1.0",
        semantics_version: "1.0",
        latency_ms: 0,
      }),
    });

    const result = await handler(client, {
      lat1: 0,
      lng1: 0,
      lat2: 0.001,
      lng2: 0,
    });

    expect(result).not.toHaveProperty("api_version");
    expect(result).not.toHaveProperty("latency_ms");
  });

  it("passes correct params to API", async () => {
    const getMock = vi.fn().mockResolvedValue({
      distance_m: 0,
      distance_mi: 0,
    });
    const client = createMockClient({ get: getMock });

    await handler(client, {
      lat1: 40.7128,
      lng1: -74.006,
      lat2: 34.0522,
      lng2: -118.2437,
    });

    expect(getMock).toHaveBeenCalledWith("/v1/distance", {
      lat1: 40.7128,
      lng1: -74.006,
      lat2: 34.0522,
      lng2: -118.2437,
    });
  });
});
