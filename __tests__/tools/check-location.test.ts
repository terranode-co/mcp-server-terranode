import { describe, it, expect, vi } from "vitest";
import { TerranodeClient } from "../../src/client.js";
import { handler } from "../../src/tools/check-location.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn(),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("check_location", () => {
  it("returns shaped response for a match", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        match: true,
        matches: [
          {
            properties: { NAME: "New York", STATEFP: "36" },
            boundary: false,
          },
        ],
        dataset: "us-states",
        api_version: "1.0",
        semantics_version: "1.0",
        latency_ms: 5,
      }),
    });

    const result = await handler(client, {
      lat: 40.7128,
      lng: -74.006,
      dataset: "us-states",
    });

    expect(result).toEqual({
      match: true,
      dataset: "us-states",
      results: [
        {
          properties: { NAME: "New York", STATEFP: "36" },
          boundary: false,
        },
      ],
    });
  });

  it("strips metadata fields from response", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        match: false,
        matches: [],
        dataset: "us-states",
        api_version: "1.0",
        semantics_version: "1.0",
        latency_ms: 3,
        version: 1,
      }),
    });

    const result = await handler(client, {
      lat: 0,
      lng: 0,
      dataset: "us-states",
    });

    expect(result).not.toHaveProperty("api_version");
    expect(result).not.toHaveProperty("semantics_version");
    expect(result).not.toHaveProperty("latency_ms");
  });

  it("sends dataset as dataset_id param", async () => {
    const getMock = vi.fn().mockResolvedValue({
      match: false,
      matches: [],
      dataset: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    const client = createMockClient({ get: getMock });

    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    await handler(client, { lat: 40, lng: -74, dataset: uuid });

    expect(getMock).toHaveBeenCalledWith("/v1/pip", { lat: 40, lng: -74, dataset_id: uuid }, uuid);
  });
});
