import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createProjectScopedMcpTools } from "@/lib/mcp/tools";
import { resolveProjectFromMcpToken } from "@/lib/projects/credentials";
import { prisma } from "@/lib/prisma";
import { getServerConfig } from "@/lib/config";
import { logger, getOrCreateCorrelationId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Timing-safe bearer token verification for legacy fallback.
 */
function isLegacyBearerAuthorized(req: NextRequest, expectedSecret: string): boolean {
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
 * Extracts plaintext token from Bearer authorization header.
 */
function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match ? match[1].trim() : null;
}

/**
 * Constructs a fresh, stateless McpServer bound to the authorized project.
 * Exposes exclusively the 4 published Sanity compliance tools scoped to this project.
 */
function buildServer(requestId: string, projectId: string) {
  const server = new McpServer({
    name: "compliance-handbook",
    version: "0.2.0",
  });

  const tools = createProjectScopedMcpTools(projectId);

  for (const tool of tools) {
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
                projectId,
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
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          let resultCount = 1;
          if ("rules" in result && Array.isArray(result.rules)) {
            resultCount = result.rules.length;
          } else if ("documents" in result && Array.isArray(result.documents)) {
            resultCount = result.documents.length;
          }

          console.log(
            JSON.stringify({
              requestId,
              projectId,
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
              projectId,
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
 * Handles incoming MCP requests with project-bound bearer resolution.
 */
async function handleMcpRequest(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req);
  const requestId = correlationId;

  // 1. Verify server configuration
  let config;
  try {
    config = getServerConfig();
  } catch (err) {
    logger.error("mcp_config_missing", { correlationId, error: (err as Error).message });
    return new NextResponse(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Correlation-Id": correlationId,
        },
      }
    );
  }

  // 2. Resolve project from project-bound Bearer token
  const token = extractBearerToken(req);
  let targetProjectId: string | null = null;
  let credentialId: string | null = null;

  if (token) {
    const resolved = await resolveProjectFromMcpToken(token);
    if (resolved) {
      targetProjectId = resolved.projectId;
      credentialId = resolved.credentialId;
    } else if (config.MCP_TOOL_SECRET && isLegacyBearerAuthorized(req, config.MCP_TOOL_SECRET)) {
      // Legacy global token fallback for testing / backward compatibility
      const firstProject = await prisma.project.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (firstProject) {
        targetProjectId = firstProject.id;
      }
    }
  }

  if (!targetProjectId) {
    logger.warn("mcp_auth_failed", {
      correlationId,
      path: req.nextUrl.pathname,
    });

    return new NextResponse(
      JSON.stringify({ error: "Unauthorized: Invalid, missing, or revoked project MCP credentials." }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="Compliance MCP"',
          "Cache-Control": "no-store",
          "X-Correlation-Id": correlationId,
        },
      }
    );
  }

  logger.info("mcp_request_authenticated", {
    correlationId,
    projectId: targetProjectId,
    credentialId,
  });

  // 3. Connect fresh stateless McpServer to WebStandardStreamableHTTPServerTransport
  const server = buildServer(requestId, targetProjectId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  // 4. Dispatch request to transport and enforce Cache-Control: no-store and correlation ID
  const response = await transport.handleRequest(req);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Correlation-Id", correlationId);
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
