import { createHash } from 'node:crypto';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { userOf, type User } from '../auth';
import { MCP_TOOLS } from '../lib/mcp-tools';
// @if db
import { writeAudit } from '../lib/audit';
// @endif

// Stateless MCP over Streamable HTTP at /mcp. In Azure, Easy Auth validates the caller's Entra
// token (Microsoft 365 Copilot SSO, a Foundry agent acting for a user) before the request reaches
// the app, and the app reads the user from X-MS-CLIENT-PRINCIPAL like any other route.

const MAX_BODY = 256 * 1024;

const result = (data: unknown, isError = false): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: data as Record<string, unknown>,
  ...(isError ? { isError: true } : {}),
});

function createServer(app: FastifyInstance, req: FastifyRequest, user: User): McpServer {
  const server = new McpServer({ name: '__APP__', version: '1.0.0' });
  for (const t of MCP_TOOLS) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async (input: unknown) => {
        let outcome = 'success';
        let out: CallToolResult;
        try {
          const data = await t.run({ app, user }, t.input.parse(input) as never);
          out = result({ ok: true, result: data });
        } catch (err) {
          outcome = 'error';
          req.log.error({ err, tool: t.name }, 'MCP tool failed');
          out = result({ ok: false, error: 'The tool failed. Try again later.' }, true);
        }
// @if db
        // One audit row per call: who, which tool and a hash of the arguments, never the values.
        await writeAudit(app.db, {
          actorId: user.id,
          action: 'mcp-call',
          entity: 'mcp-tool',
          entityId: t.name,
          detail: {
            argsSha256: createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex'),
            outcome,
          },
        });
// @endif
// @if !db
        req.log.info({ tool: t.name, outcome, argsSha256: createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex') }, 'MCP tool call');
// @endif
        return out;
      },
    );
  }
  return server;
}

export async function mcpRoutes(app: FastifyInstance) {
  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    handler: async (req, reply) => {
      const user = userOf(req);
      const handler = createMcpHandler(() => createServer(app, req, user), { maxRequestBodySize: MAX_BODY });
      const nodeHandler = toNodeHandler(handler, { maxRequestBodySize: MAX_BODY });
      reply.hijack();
      try {
        await nodeHandler(req.raw, reply.raw, req.body);
      } finally {
        await handler.close();
      }
    },
  });
}
