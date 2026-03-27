import { describe, it, expect, vi, afterEach } from "vitest";
import { TerranodeClient, TerranodeApiError } from "../src/client.js";

describe("TerranodeClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown, ok?: boolean) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: ok ?? (status >= 200 && status < 300),
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    });
  }

  it("sends x-api-key header on GET", async () => {
    mockFetch(200, { data: "test" });
    const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

    await client.get("/v1/datasets");

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers["x-api-key"]).toBe("tn_test");
  });

  it("sends x-api-key header on POST", async () => {
    mockFetch(200, { data: "test" });
    const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

    await client.post("/v1/spatial-join", [{ lat: 0, lng: 0 }]);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers["x-api-key"]).toBe("tn_test");
    expect(fetchCall[1].headers["Content-Type"]).toBe("application/json");
  });

  it("builds URL with query params, omitting undefined", async () => {
    mockFetch(200, {});
    const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

    await client.get("/v1/pip", { lat: 40, lng: -74, n: undefined });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(fetchCall[0]);
    expect(url.searchParams.get("lat")).toBe("40");
    expect(url.searchParams.get("lng")).toBe("-74");
    expect(url.searchParams.has("n")).toBe(false);
  });

  it("strips trailing slash from baseUrl", async () => {
    mockFetch(200, {});
    const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com/" });

    await client.get("/v1/datasets");

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("https://api.example.com/v1/datasets");
  });

  describe("error mapping", () => {
    it("maps 400 with API message", async () => {
      mockFetch(400, { message: "lat must be a number" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip")).rejects.toThrow("lat must be a number");
    });

    it("maps 401 to auth error", async () => {
      mockFetch(401, { message: "Unauthorized" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip")).rejects.toThrow("Invalid or missing API key");
    });

    it("maps 403 to access denied", async () => {
      mockFetch(403, { message: "Forbidden" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip")).rejects.toThrow("Access denied");
    });

    it("maps 404 with dataset name", async () => {
      mockFetch(404, { message: "Not Found" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip", {}, "us-widgets")).rejects.toThrow(
        "Dataset 'us-widgets' not found. Use list_datasets to see available datasets.",
      );
    });

    it("maps 429 to rate limit", async () => {
      mockFetch(429, { message: "Too Many Requests" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip")).rejects.toThrow("Rate limit exceeded");
    });

    it("maps 500 to generic server error", async () => {
      mockFetch(500, { message: "Internal Server Error" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.get("/v1/pip")).rejects.toThrow("Terranode API error");
    });

    it("error has status code", async () => {
      mockFetch(429, { message: "Too Many Requests" });
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      try {
        await client.get("/v1/pip");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TerranodeApiError);
        expect((err as TerranodeApiError).status).toBe(429);
      }
    });
  });

  describe("resolveDataset", () => {
    it("passes UUID through as dataset_id", async () => {
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      const result = await client.resolveDataset("2e61d91c-dd8c-4c33-8a4f-8a6da7110222");
      expect(result).toEqual({ dataset_id: "2e61d91c-dd8c-4c33-8a4f-8a6da7110222" });
    });

    it("resolves system slug to UUID via list endpoints", async () => {
      // First two calls: system-datasets, then datasets
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const body = callCount === 1 ? [{ datasetId: "sys-uuid-1", slug: "us-counties" }] : [];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      });

      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });
      const result = await client.resolveDataset("us-counties");
      expect(result).toEqual({ dataset_id: "sys-uuid-1" });
    });

    it("resolves custom slug to UUID", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const body = callCount === 1 ? [] : [{ datasetId: "user-uuid-1", slug: "my-zones" }];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      });

      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });
      const result = await client.resolveDataset("my-zones");
      expect(result).toEqual({ dataset_id: "user-uuid-1" });
    });

    it("throws 404 for unknown slug", async () => {
      mockFetch(200, []);
      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });

      await expect(client.resolveDataset("nonexistent")).rejects.toThrow(
        "Dataset 'nonexistent' not found",
      );
    });

    it("caches list results across calls", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const body = callCount === 1 ? [{ datasetId: "sys-uuid-1", slug: "us-counties" }] : [];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      });

      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });
      await client.resolveDataset("us-counties");
      await client.resolveDataset("us-counties");

      // Only 2 fetch calls (system + custom), not 4
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("fetchAndCacheDatasets refreshes the cache", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
          text: () => Promise.resolve("[]"),
        });
      });

      const client = new TerranodeClient({ apiKey: "tn_test", baseUrl: "https://api.example.com" });
      await client.fetchAndCacheDatasets();
      await client.fetchAndCacheDatasets();

      // 4 calls: 2 per fetchAndCacheDatasets (always refreshes)
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });
});
