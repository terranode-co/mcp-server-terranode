/**
 * HTTP client for the Terranode REST API.
 * Handles auth, base URL, and error mapping to agent-friendly messages.
 */

export class TerranodeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TerranodeApiError";
  }
}

export const API_VERSION = "v1";

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Maps HTTP error status to an agent-friendly error message.
 */
function mapHttpError(status: number, body: string, dataset?: string): string {
  switch (status) {
    case 400: {
      // API validation errors are already human-readable
      try {
        const parsed = JSON.parse(body);
        return parsed.message || body;
      } catch {
        return body;
      }
    }
    case 401:
      return "Invalid or missing API key. Check your TERRANODE_API_KEY configuration.";
    case 403:
      return "Access denied. Your API key does not have access to this resource.";
    case 404:
      if (dataset) {
        return `Dataset '${dataset}' not found. Use list_datasets to see available datasets.`;
      }
      return "Resource not found.";
    case 429:
      return "Rate limit exceeded. Wait a moment and try again.";
    default:
      if (status >= 500) {
        return "Terranode API error. Try again shortly.";
      }
      return `Unexpected error (HTTP ${status}).`;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DatasetEntry {
  datasetId: string;
  name: string;
  slug?: string;
  description?: string;
  summary?: string;
  status?: string;
  features?: number;
  geometryType?: string;
  bbox?: number[];
}

export class TerranodeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private datasetCache: { system: DatasetEntry[]; custom: DatasetEntry[] } | null = null;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    // Strip trailing slash
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  /**
   * Fetch both dataset lists and refresh the cache. Called by list_datasets
   * (which always refreshes) and resolveDataset (which uses cached on hit).
   */
  async fetchAndCacheDatasets(): Promise<{ system: DatasetEntry[]; custom: DatasetEntry[] }> {
    const [systemRaw, customRaw] = await Promise.all([
      this.get(`/${API_VERSION}/system-datasets`),
      this.get(`/${API_VERSION}/datasets`),
    ]);
    this.datasetCache = {
      system: systemRaw as DatasetEntry[],
      custom: customRaw as DatasetEntry[],
    };
    return this.datasetCache;
  }

  /**
   * Resolve a dataset identifier to the correct query param.
   * UUIDs pass through as dataset_id. Slugs are resolved via list endpoints.
   */
  async resolveDataset(identifier: string): Promise<Record<string, string>> {
    if (UUID_RE.test(identifier)) {
      return { dataset_id: identifier };
    }

    // Slug — resolve to UUID via cached dataset list
    const cache = this.datasetCache ?? (await this.fetchAndCacheDatasets());

    const systemMatch = cache.system.find((d) => d.slug === identifier);
    if (systemMatch) return { dataset_id: systemMatch.datasetId };

    const customMatch = cache.custom.find((d) => d.slug === identifier);
    if (customMatch) return { dataset_id: customMatch.datasetId };

    throw new TerranodeApiError(
      `Dataset '${identifier}' not found. Use list_datasets to see available datasets.`,
      404,
    );
  }

  /**
   * GET request to the API.
   */
  async get(
    path: string,
    params?: Record<string, string | number | undefined>,
    dataset?: string,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": this.apiKey,
        "X-Terranode-Channel": "mcp",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new TerranodeApiError(mapHttpError(response.status, body, dataset), response.status);
    }

    return response.json();
  }

  /**
   * POST request to the API with JSON body.
   */
  async post(
    path: string,
    body: unknown,
    params?: Record<string, string | number | undefined>,
    dataset?: string,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "X-Terranode-Channel": "mcp",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new TerranodeApiError(
        mapHttpError(response.status, responseBody, dataset),
        response.status,
      );
    }

    return response.json();
  }
}
