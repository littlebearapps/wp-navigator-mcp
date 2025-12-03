#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const serverPath = path.resolve(__dirname, '../dist/index.js');
  const cwd = path.resolve(__dirname, '..');

  // Build a resolved JSON config for the server to avoid ${VAR} expansion issues
  const envPath = path.resolve(cwd, '../../.local-wp.env');
  const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const kv = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('#')) continue;
    // strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // ignore shell-style expansions; we'll compute below
    kv[key] = val;
  }
  const baseUrl = kv.WP_BASE_URL || 'http://localhost:8991';
  const restApi = (kv.WP_REST_API && !kv.WP_REST_API.includes('${')) ? kv.WP_REST_API : `${baseUrl.replace(/\/$/, '')}/wp-json`;
  const wpnavBase = (kv.WPNAV_BASE && !kv.WPNAV_BASE.includes('${')) ? kv.WPNAV_BASE : `${restApi.replace(/\/$/, '')}/wpnav/v1`;
  const wpnavIntro = (kv.WPNAV_INTROSPECT && !kv.WPNAV_INTROSPECT.includes('${')) ? kv.WPNAV_INTROSPECT : `${wpnavBase.replace(/\/$/, '')}/introspect`;
  const appUser = kv.WP_APP_USER || 'admin';
  const appPass = kv.WP_APP_PASS || 'password';
  const cfg = {
    WP_BASE_URL: baseUrl,
    WP_REST_API: restApi,
    WPNAV_BASE: wpnavBase,
    WPNAV_INTROSPECT: wpnavIntro,
    WP_APP_USER: appUser,
    WP_APP_PASS: appPass,
  };
  const cfgPath = path.join(os.tmpdir(), `wpnav-report-${Date.now()}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath, cfgPath],
    cwd,
    env: { ...process.env, WPNAV_ENABLE_WRITES: process.env.WPNAV_ENABLE_WRITES || '0' },
    stderr: 'inherit',
  });

  const client = new Client({ name: 'wpnav-reporter', version: '0.1.0' });
  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const help = await client.callTool({ name: 'wpnav_help', arguments: {} });
    const helpText = (help?.content || []).find(c => c.type === 'text')?.text || '';

    const summary = {
      toolCount: Array.isArray(tools) ? tools.length : 0,
      toolNames: (tools || []).map(t => t.name),
      helpText,
    };

    console.log(JSON.stringify(summary, null, 2));
    await client.close();
    try { fs.unlinkSync(cfgPath); } catch {}
  } catch (err) {
    console.error('report-tools error:', err?.message || String(err));
    try { await client.close(); } catch {}
    try { fs.unlinkSync(cfgPath); } catch {}
    process.exit(1);
  }
}

main();
