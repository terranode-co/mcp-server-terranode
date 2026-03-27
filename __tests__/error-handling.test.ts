import { describe, it, expect, vi } from "vitest";
import { TerranodeClient, TerranodeApiError } from "../src/client.js";
import { handler as checkLocationHandler } from "../src/tools/check-location.js";
import { handler as listDatasetsHandler } from "../src/tools/list-datasets.js";
import { handler as findNearestHandler } from "../src/tools/find-nearest.js";
import { handler as calculateDistanceHandler } from "../src/tools/calculate-distance.js";
import { handler as spatialJoinHandler } from "../src/tools/spatial-join.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn().mockResolvedValue({ system: [], custom: [] }),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("error propagation", () => {
  it("check_location propagates TerranodeApiError", async () => {
    const client = createMockClient({
      resolveDataset: vi
        .fn()
        .mockRejectedValue(
          new TerranodeApiError(
            "Dataset 'us-widgets' not found. Use list_datasets to see available datasets.",
            404,
          ),
        ),
    });

    await expect(
      checkLocationHandler(client, { lat: 40, lng: -74, dataset: "us-widgets" }),
    ).rejects.toThrow("Dataset 'us-widgets' not found");
  });

  it("list_datasets propagates auth error", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi
        .fn()
        .mockRejectedValue(
          new TerranodeApiError(
            "Invalid or missing API key. Check your TERRANODE_API_KEY configuration.",
            401,
          ),
        ),
    });

    await expect(listDatasetsHandler(client)).rejects.toThrow("Invalid or missing API key");
  });

  it("find_nearest propagates rate limit error", async () => {
    const client = createMockClient({
      get: vi
        .fn()
        .mockRejectedValue(
          new TerranodeApiError("Rate limit exceeded. Wait a moment and try again.", 429),
        ),
    });

    await expect(
      findNearestHandler(client, { lat: 40, lng: -74, dataset: "us-counties" }),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("calculate_distance propagates validation error", async () => {
    const client = createMockClient({
      get: vi.fn().mockRejectedValue(new TerranodeApiError("lat1 must be between -90 and 90", 400)),
    });

    await expect(
      calculateDistanceHandler(client, { lat1: 999, lng1: 0, lat2: 0, lng2: 0 }),
    ).rejects.toThrow("lat1 must be between -90 and 90");
  });

  it("spatial_join propagates server error", async () => {
    const client = createMockClient({
      post: vi
        .fn()
        .mockRejectedValue(new TerranodeApiError("Terranode API error. Try again shortly.", 500)),
    });

    await expect(
      spatialJoinHandler(client, { points: [{ lat: 40, lng: -74 }], dataset: "us-states" }),
    ).rejects.toThrow("Terranode API error");
  });
});
