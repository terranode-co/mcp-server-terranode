# @terranode-co/mcp-server

MCP server for spatial queries via the [Terranode Geospatial API](https://docs.terranode.co). Gives AI agents (Claude Desktop, Cursor, etc.) tools to query geospatial datasets — point-in-polygon lookups, nearest feature search, distance calculations, and spatial joins.

## Prerequisites

- Node.js 18+
- A Terranode API key — [sign up at app.terranode.co](https://app.terranode.co)

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "terranode": {
      "command": "npx",
      "args": ["@terranode-co/mcp-server"],
      "env": {
        "TERRANODE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "terranode": {
      "command": "npx",
      "args": ["@terranode-co/mcp-server"],
      "env": {
        "TERRANODE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "terranode": {
      "command": "npx",
      "args": ["@terranode-co/mcp-server"],
      "env": {
        "TERRANODE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available tools

| Tool                 | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `list_datasets`      | List all available geospatial datasets (system + custom)    |
| `check_location`     | Point-in-polygon: which feature contains a coordinate?      |
| `find_nearest`       | Find the N nearest features to a coordinate, with distances |
| `calculate_distance` | Geodesic distance between two points (meters + miles)       |
| `spatial_join`       | Enrich multiple coordinates with polygon attributes at once |

## Example prompts

Try these in Claude Desktop or Cursor:

- "What county is latitude 40.71, longitude -74.00 in?"
- "What datasets are available?"
- "Find the 3 nearest counties to Central Park"
- "How close is my proposed site (40.7128, -74.006) to the nearest school (34.0522, -118.2437)?"
- "Which states do these 5 warehouse locations fall in?" (paste coordinates)
- "What ZIP code is 37.7749, -122.4194 in?"

## API Reference

The full API spec is available at [docs.terranode.co/openapi.yaml](https://docs.terranode.co/openapi.yaml) (OpenAPI 3.1).

## Feedback

Report issues or feature requests: [feedback@terranode.co](mailto:feedback@terranode.co)
