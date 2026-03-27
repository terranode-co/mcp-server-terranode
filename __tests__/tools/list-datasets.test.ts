import { describe, it, expect, vi } from "vitest";
import { TerranodeClient, TerranodeApiError } from "../../src/client.js";
import { handler } from "../../src/tools/list-datasets.js";

function createMockClient(overrides: Partial<TerranodeClient> = {}): TerranodeClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    resolveDataset: vi.fn().mockImplementation((id: string) => Promise.resolve({ dataset_id: id })),
    fetchAndCacheDatasets: vi.fn().mockResolvedValue({ system: [], custom: [] }),
    ...overrides,
  } as unknown as TerranodeClient;
}

describe("list_datasets", () => {
  it("combines system and custom datasets", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi.fn().mockResolvedValue({
        system: [
          {
            datasetId: "sys-1",
            slug: "us-states",
            name: "US States",
            description: "State boundaries",
            features: 56,
            bbox: [-179.17, 17.88, -66.95, 71.39],
          },
        ],
        custom: [
          {
            datasetId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            name: "My Zones",
            description: "Delivery zones",
            features: 12,
            bbox: [-74.5, 40.4, -73.7, 40.9],
          },
        ],
      }),
    });

    const result = await handler(client);

    expect(result.datasets).toHaveLength(2);
    expect(result.datasets[0]).toEqual({
      name: "US States",
      slug: "us-states",
      id: "sys-1",
      type: "system",
      description: "State boundaries",
      summary: undefined,
      status: undefined,
      featureCount: 56,
      geometryType: undefined,
      bbox: [-179.17, 17.88, -66.95, 71.39],
    });
    expect(result.datasets[1]).toEqual({
      name: "My Zones",
      slug: undefined,
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      type: "custom",
      description: "Delivery zones",
      summary: undefined,
      status: undefined,
      featureCount: 12,
      geometryType: undefined,
      bbox: [-74.5, 40.4, -73.7, 40.9],
    });
  });

  it("calls fetchAndCacheDatasets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ system: [], custom: [] });
    const client = createMockClient({ fetchAndCacheDatasets: fetchMock });

    await handler(client);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles empty dataset lists", async () => {
    const client = createMockClient();

    const result = await handler(client);
    expect(result.datasets).toEqual([]);
  });

  it("rejects if fetchAndCacheDatasets fails", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi
        .fn()
        .mockRejectedValue(new TerranodeApiError("Terranode API error. Try again shortly.", 500)),
    });

    await expect(handler(client)).rejects.toThrow("Terranode API error");
  });

  it("prefixes system dataset name on slug collision with custom dataset", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi.fn().mockResolvedValue({
        system: [{ datasetId: "sys-1", slug: "us-counties", name: "US Counties", features: 3234 }],
        custom: [{ datasetId: "user-1", name: "US Counties", slug: "us-counties", features: 50 }],
      }),
    });

    const result = await handler(client);
    expect(result.datasets[0].name).toBe("Terranode: US Counties");
    expect(result.datasets[1].name).toBe("US Counties");
  });

  it("no prefix when no slug collision", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi.fn().mockResolvedValue({
        system: [{ datasetId: "sys-1", slug: "us-counties", name: "US Counties", features: 3234 }],
        custom: [{ datasetId: "user-1", name: "My Zones", slug: "my-zones", features: 50 }],
      }),
    });

    const result = await handler(client);
    expect(result.datasets[0].name).toBe("US Counties");
    expect(result.datasets[1].name).toBe("My Zones");
  });

  it("surfaces description and summary as separate fields", async () => {
    const client = createMockClient({
      fetchAndCacheDatasets: vi.fn().mockResolvedValue({
        system: [
          {
            datasetId: "sys-1",
            slug: "us-counties",
            name: "US Counties",
            description: "County boundaries",
            summary: "County boundaries from Census, ~3200 features",
            features: 3234,
          },
        ],
        custom: [],
      }),
    });

    const result = await handler(client);
    expect(result.datasets[0].description).toBe("County boundaries");
    expect(result.datasets[0].summary).toBe("County boundaries from Census, ~3200 features");
  });
});
