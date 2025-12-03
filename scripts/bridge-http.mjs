#!/usr/bin/env node
import http from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function startBridge({ serverPath, configPath, cwd, env }) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath, configPath], cwd, env, stderr: 'inherit' });
  const client = new Client({ name: 'wpnav-bridge', version: '0.1.0' });
  await client.connect(transport);

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/tools') {
        const tools = await client.listTools();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tools));
        return;
      }
      if (req.method === 'POST' && req.url === '/call') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { name, arguments: args = {} } = JSON.parse(body || '{}');
            const result = await client.callTool({ name, arguments: args });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e?.message || e) }));
          }
        });
        return;
      }
      if (req.method === 'GET' && req.url === '/events') {
        // Prototype SSE endpoint (no continuous events yet)
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`event: ready\n`);
        res.write(`data: {"status":"ok"}\n\n`);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(e?.message || e));
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    async close() {
      try { await client.close(); } catch {}
      server.close();
    },
  };
}

// If invoked directly, run the bridge standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const serverPath = process.argv[2];
  const configPath = process.argv[3];
  const cwd = process.cwd();
  startBridge({ serverPath, configPath, cwd, env: process.env }).then(({ baseUrl }) => {
    console.error(`MCP HTTP bridge on ${baseUrl}`);
  });
}

