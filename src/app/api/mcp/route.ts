import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpTools } from "@/lib/mcp/tools";
import { getServerConfig } from "@/lib/config";

export const maxDuration = 30;

/**
 * Timing-safe bearer token verification.
 * Does not log credentials and checks byte-by-byte equality.
 */
function isBearerAuthorized(req: NextRequest, expectedSecret: string): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return false;

  const token = match[1].trim();
  const tokenBuf = Buffer.from(token, "utf8");
  const expectedBuf = Buffer.from(expectedSecret, "utf8");

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Constructs a fresh, stateless McpServer per request.
 * Exposes exclusively the 4 published Sanity compliance tools.
 */
function buildServer(requestId: string) {
  const server = new McpServer({
    name: "compliance-handbook",
    version: "0.1.0",
  });

  for (const tool of mcpTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.shape,
      async (args: any) => {
        const startTime = Date.now();
        try {
          const result = await tool.handler(args);
          const durationMs = Date.now() - startTime;

          if ("isError" in result && result.isError) {
            console.log(
              JSON.stringify({
                requestId,
                tool: tool.name,
                durationMs,
                errorCode: result.errorCode,
                success: false,
              })
            );

            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    code: result.errorCode,
                    message: result.error,
                  }),
                },
              ],
            };
          }

          // Count results for structured logging without logging content bodies
          let resultCount = 1;
          if ("rules" in result && Array.isArray(result.rules)) {
            resultCount = result.rules.length;
          } else if ("documents" in result && Array.isArray(result.documents)) {
            resultCount = result.documents.length;
          }

          console.log(
            JSON.stringify({
              requestId,
              tool: tool.name,
              durationMs,
              resultCount,
              success: true,
            })
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const durationMs = Date.now() - startTime;
          console.error(
            JSON.stringify({
              requestId,
              tool: tool.name,
              durationMs,
              errorCode: "INTERNAL_ERROR",
              success: false,
            })
          );

          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "INTERNAL_ERROR",
                  message: "An unexpected error occurred while executing the compliance tool.",
                }),
              },
            ],
          };
        }
      }
    );
  }

  return server;
}

/**
 * Handles incoming MCP requests with strict bearer gate and stateless Streamable HTTP transport.
 */
async function handleMcpRequest(req: NextRequest) {
  const requestId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Verify server configuration
  let config;
  try {
    config = getServerConfig();
  } catch (err) {
    console.error(`[${requestId}] Missing server configuration:`, err);
    return new NextResponse(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // 2. Strict Bearer Authentication before transport processing or tool execution
  if (!isBearerAuthorized(req, config.MCP_TOOL_SECRET)) {
    console.log(
      JSON.stringify({
        requestId,
        authOutcome: "failed",
        path: req.nextUrl.pathname,
      })
    );

    return new NextResponse(
      JSON.stringify({ error: "Unauthorized: Invalid or missing bearer credentials." }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="Compliance MCP"',
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // 3. Connect fresh stateless McpServer to WebStandardStreamableHTTPServerTransport
  const server = buildServer(requestId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  // 4. Dispatch request to transport and enforce Cache-Control: no-store
  const response = await transport.handleRequest(req);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function GET(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleMcpRequest(req);
}
