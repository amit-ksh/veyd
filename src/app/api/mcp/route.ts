import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpTools } from "@/lib/mcp/tools";

// Exposes the compliance engine as a Model Context Protocol server, so any
// MCP-capable agent (Claude, an internal copilot, whatever a workspace wires up)
// can look up the rule that applies and log a verification against it, instead
// of answering compliance questions from memory. Bearer-token gated by
// MCP_TOOL_SECRET so only agents you've configured can write verification logs.

function buildServer() {
  const server = new McpServer({ name: "compliance-handbook", version: "0.1.0" });

  for (const tool of mcpTools) {
    server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args: any) => {
      const result = await tool.handler(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    });
  }

  return server;
}

function isAuthorized(req: NextRequest) {
  const secret = process.env.MCP_TOOL_SECRET;
  if (!secret) return true; // no secret configured (local dev) -> allow
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const body = await req.json();
  // Adapt the transport's Node-style handler to the Fetch Request/Response
  // shape Next.js route handlers use.
  return transport.handleRequest(req as unknown as Request, body);
}

export async function GET() {
  return NextResponse.json({
    name: "compliance-handbook",
    protocol: "mcp",
    tools: mcpTools.map((t) => ({ name: t.name, description: t.description })),
  });
}
