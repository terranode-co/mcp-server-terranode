import { type DatasetEntry, TerranodeClient } from "../client.js";

export const name = "list_datasets";

export const description =
  "List all geospatial datasets available for querying. Returns pre-loaded " +
  "public datasets (US states, counties, ZIP codes, etc.) and your custom uploaded " +
  "datasets. Each dataset has an id (UUID) — always use the id when calling other tools.";

export const inputSchema = {};

export async function handler(client: TerranodeClient) {
  const cached = await client.fetchAndCacheDatasets();
  const systemDatasets = cached.system;
  const customDatasets = cached.custom;

  // Detect slug collisions for display name disambiguation (matches n8n pattern)
  const systemSlugs = new Set(systemDatasets.map((d) => d.slug).filter(Boolean));
  const collidingSlugs = new Set(
    customDatasets.filter((d) => d.slug && systemSlugs.has(d.slug)).map((d) => d.slug),
  );

  function mapDataset(d: DatasetEntry, type: "system" | "custom") {
    const prefix = type === "system" && collidingSlugs.has(d.slug) ? "Terranode: " : "";
    return {
      name: `${prefix}${d.name}`,
      slug: d.slug || undefined,
      id: d.datasetId,
      type,
      description: d.description || undefined,
      summary: d.summary || undefined,
      status: d.status || undefined,
      featureCount: d.features,
      geometryType: d.geometryType || undefined,
      bbox: d.bbox,
    };
  }

  const datasets = [
    ...systemDatasets.map((d) => mapDataset(d, "system")),
    ...customDatasets.map((d) => mapDataset(d, "custom")),
  ];

  return { datasets };
}
