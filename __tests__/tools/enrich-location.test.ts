import { describe, it, expect, vi } from "vitest";
import { TerranodeClient } from "../../src/client.js";
import { handler } from "../../src/tools/enrich-location.js";

function createMockClient(
  overrides: Partial<TerranodeClient> = {},
): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn(),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("enrich_location", () => {
  it("returns shaped response for enrichment results", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        summary: {
          datasets_queried: 2,
          datasets_matched: 2,
          requests_charged: 2,
        },
        results: [
          {
            dataset: "us-counties",
            type: "system",
            version: 1,
            match: true,
            intersections: [
              {
                properties: { NAME: "New York", STATEFP: "36" },
                on_boundary: false,
                distance_m: 0,
                distance_mi: 0,
              },
            ],
          },
          {
            dataset: "us-states",
            type: "system",
            version: 1,
            match: true,
            intersections: [
              {
                properties: { NAME: "New York", STUSPS: "NY" },
                on_boundary: false,
                distance_m: 0,
                distance_mi: 0,
              },
            ],
          },
        ],
        errors: [],
        latency_ms: 14,
        api_version: "v1",
        semantics_version: "0.1.0",
      }),
    });

    const result = await handler(client, { lat: 40.7128, lng: -74.006 });

    expect(result.summary).toEqual({
      datasets_queried: 2,
      datasets_matched: 2,
      requests_charged: 2,
    });
    expect(result.results).toHaveLength(2);
    expect(result.results[0].dataset).toBe("us-counties");
    expect(result.results[0].match).toBe(true);
    expect(result.results[0].intersections).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("strips metadata fields from response", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        summary: {
          datasets_queried: 1,
          datasets_matched: 0,
          requests_charged: 1,
        },
        results: [
          {
            dataset: "us-counties",
            type: "system",
            version: 1,
            match: false,
            intersections: [],
          },
        ],
        errors: [],
        latency_ms: 5,
        api_version: "v1",
        semantics_version: "0.1.0",
      }),
    });

    const result = await handler(client, { lat: 0, lng: 0 });

    expect(result).not.toHaveProperty("latency_ms");
    expect(result).not.toHaveProperty("api_version");
    expect(result).not.toHaveProperty("semantics_version");
  });

  it("passes radius when provided", async () => {
    const getMock = vi.fn().mockResolvedValue({
      summary: {
        datasets_queried: 0,
        datasets_matched: 0,
        requests_charged: 0,
      },
      results: [],
      errors: [],
    });
    const client = createMockClient({ get: getMock });

    await handler(client, { lat: 40, lng: -74, radius: 5000 });

    expect(getMock).toHaveBeenCalledWith("/v1/enrich", {
      lat: 40,
      lng: -74,
      radius: 5000,
    });
  });

  it("omits radius when not provided", async () => {
    const getMock = vi.fn().mockResolvedValue({
      summary: {
        datasets_queried: 0,
        datasets_matched: 0,
        requests_charged: 0,
      },
      results: [],
      errors: [],
    });
    const client = createMockClient({ get: getMock });

    await handler(client, { lat: 40, lng: -74 });

    expect(getMock).toHaveBeenCalledWith("/v1/enrich", { lat: 40, lng: -74 });
  });

  it("strips version from results", async () => {
    const client = createMockClient({
      get: vi.fn().mockResolvedValue({
        summary: {
          datasets_queried: 1,
          datasets_matched: 1,
          requests_charged: 1,
        },
        results: [
          {
            dataset: "us-counties",
            type: "system",
            version: 3,
            match: true,
            intersections: [
              { properties: { NAME: "Test" }, on_boundary: false },
            ],
          },
        ],
        errors: [],
        latency_ms: 10,
      }),
    });

    const result = await handler(client, { lat: 40, lng: -74 });

    expect(result.results[0]).not.toHaveProperty("version");
  });
});
