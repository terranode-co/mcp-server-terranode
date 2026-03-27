import { describe, it, expect, vi } from "vitest";
import { TerranodeClient } from "../../src/client.js";
import { handler } from "../../src/tools/spatial-join.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn(),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("spatial_join", () => {
  it("returns shaped join results", async () => {
    const client = createMockClient({
      post: vi.fn().mockResolvedValue({
        dataset: "us-states",
        summary: { total: 2, joined: 1, unjoined: 1 },
        results: [
          {
            index: 0,
            input: { lat: 40.7128, lng: -74.006 },
            joined: true,
            match_count: 1,
            matches: [
              { properties: { NAME: "New York" }, boundary: false, distance_m: 0, distance_mi: 0 },
            ],
          },
          {
            index: 1,
            input: { lat: 51.5074, lng: -0.1278 },
            joined: false,
            match_count: 0,
            matches: [],
          },
        ],
        api_version: "1.0",
        latency_ms: 15,
      }),
    });

    const result = await handler(client, {
      points: [
        { lat: 40.7128, lng: -74.006 },
        { lat: 51.5074, lng: -0.1278 },
      ],
      dataset: "us-states",
    });

    expect(result).toEqual({
      dataset: "us-states",
      results: [
        {
          point: { lat: 40.7128, lng: -74.006 },
          match: true,
          properties: { NAME: "New York" },
        },
        {
          point: { lat: 51.5074, lng: -0.1278 },
          match: false,
          properties: null,
        },
      ],
    });
  });

  it("passes point properties through in request body", async () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const postMock = vi.fn().mockResolvedValue({
      dataset: uuid,
      results: [
        {
          index: 0,
          input: { lat: 40, lng: -74, id: "nyc" },
          joined: true,
          match_count: 1,
          matches: [{ properties: { NAME: "New York" } }],
        },
      ],
    });
    const client = createMockClient({ post: postMock });

    await handler(client, {
      points: [{ lat: 40, lng: -74, properties: { id: "nyc" } }],
      dataset: uuid,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/v1/spatial-join",
      [{ lat: 40, lng: -74, id: "nyc" }],
      { dataset_id: uuid },
      uuid,
    );
  });

  it("uses dataset_id for UUID datasets", async () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const postMock = vi.fn().mockResolvedValue({
      dataset: uuid,
      results: [],
    });
    const client = createMockClient({ post: postMock });

    await handler(client, {
      points: [{ lat: 40, lng: -74 }],
      dataset: uuid,
    });

    expect(postMock).toHaveBeenCalledWith(
      "/v1/spatial-join",
      [{ lat: 40, lng: -74 }],
      { dataset_id: uuid },
      uuid,
    );
  });
});
