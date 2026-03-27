import { describe, it, expect, vi } from "vitest";
import { TerranodeClient } from "../../src/client.js";
import { handler } from "../../src/tools/find-nearest.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn(),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("find_nearest", () => {
  it("returns shaped nearest results", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        matches: [
          {
            properties: { NAME: "New York County" },
            within: true,
            distance_m: 1234.5,
            distance_mi: 0.77,
          },
          {
            properties: { NAME: "Kings County" },
            within: false,
            distance_m: 5678.9,
            distance_mi: 3.53,
          },
        ],
        dataset: "us-counties",
        api_version: "1.0",
        latency_ms: 10,
      }),
    });

    const result = await handler(client, {
      lat: 40.7128,
      lng: -74.006,
      dataset: "us-counties",
      n: 2,
    });

    expect(result).toEqual({
      dataset: "us-counties",
      results: [
        {
          properties: { NAME: "New York County" },
          within: true,
          distance_m: 1234.5,
          distance_mi: 0.77,
        },
        {
          properties: { NAME: "Kings County" },
          within: false,
          distance_m: 5678.9,
          distance_mi: 3.53,
        },
      ],
    });
  });

  it("passes optional n and radius params", async () => {
    const getMock = vi.fn().mockResolvedValue({
      matches: [],
      dataset: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    });
    const client = createMockClient({ get: getMock });

    const uuid = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    await handler(client, {
      lat: 40,
      lng: -74,
      dataset: uuid,
      n: 5,
      radius: 10000,
    });

    expect(getMock).toHaveBeenCalledWith(
      "/v1/nearest",
      {
        lat: 40,
        lng: -74,
        dataset_id: uuid,
        n: 5,
        radius: 10000,
      },
      uuid,
    );
  });

  it("omits undefined optional params", async () => {
    const getMock = vi.fn().mockResolvedValue({
      matches: [],
      dataset: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    });
    const client = createMockClient({ get: getMock });

    const uuid = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    await handler(client, {
      lat: 40,
      lng: -74,
      dataset: uuid,
    });

    expect(getMock).toHaveBeenCalledWith(
      "/v1/nearest",
      {
        lat: 40,
        lng: -74,
        dataset_id: uuid,
        n: undefined,
        radius: undefined,
      },
      uuid,
    );
  });
});
