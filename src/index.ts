#!/usr/bin/env node

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TerranodeClient, TerranodeApiError } from "./client.js";
import * as listDatasets from "./tools/list-datasets.js";
import * as checkLocation from "./tools/check-location.js";
import * as findNearest from "./tools/find-nearest.js";
import * as calculateDistance from "./tools/calculate-distance.js";
import * as spatialJoin from "./tools/spatial-join.js";
import * as enrichLocation from "./tools/enrich-location.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const DEFAULT_API_URL = "https://api.terranode.co";

function log(message: string): void {
  process.stderr.write(`[terranode-mcp] ${message}\n`);
}

// Validate configuration at startup
const apiKey = process.env.TERRANODE_API_KEY;
if (!apiKey) {
  log("ERROR: TERRANODE_API_KEY environment variable is required.");
  log("Get your API key at https://app.terranode.co");
  process.exit(1);
}

const apiUrl = process.env.TERRANODE_API_URL || DEFAULT_API_URL;
const client = new TerranodeClient({ apiKey, baseUrl: apiUrl });

log(`API key configured: yes`);
log(`API URL: ${apiUrl}`);

// Create server
const server = new McpServer(
  { name: "terranode", version: pkg.version as string },
  { capabilities: { tools: {} } },
);

/**
 * Wraps a tool handler to catch errors and return MCP-formatted error responses.
 */
function wrapHandler<T>(
  toolName: string,
  fn: (client: TerranodeClient, args: T) => Promise<unknown>,
) {
  return async (args: T) => {
    try {
      const result = await fn(client, args);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err) {
      const message =
        err instanceof TerranodeApiError
          ? err.message
          : "An unexpected error occurred. Please try again.";

      log(`Tool ${toolName} error: ${message}`);
      return {
        content: [{ type: "text" as const, text: message }],
        isError: true,
      };
    }
  };
}

// Register tools

server.tool(
  listDatasets.name,
  listDatasets.description,
  listDatasets.inputSchema,
  wrapHandler(listDatasets.name, listDatasets.handler),
);

server.tool(
  checkLocation.name,
  checkLocation.description,
  checkLocation.inputSchema,
  wrapHandler(checkLocation.name, checkLocation.handler),
);

server.tool(
  findNearest.name,
  findNearest.description,
  findNearest.inputSchema,
  wrapHandler(findNearest.name, findNearest.handler),
);

server.tool(
  calculateDistance.name,
  calculateDistance.description,
  calculateDistance.inputSchema,
  wrapHandler(calculateDistance.name, calculateDistance.handler),
);

server.tool(
  spatialJoin.name,
  spatialJoin.description,
  spatialJoin.inputSchema,
  wrapHandler(spatialJoin.name, spatialJoin.handler),
);

server.tool(
  enrichLocation.name,
  enrichLocation.description,
  enrichLocation.inputSchema,
  wrapHandler(enrichLocation.name, enrichLocation.handler),
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Server started on stdio");
}

main().catch((err) => {
  log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
