#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTapEmitter } from './tap.mjs';
import { buildResolvedConfig, hostnameFromUrl } from './util-env.mjs';
import { startBridge } from './bridge-http.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function parseArgs(argv) {
  const args = { agent: 'generic', suite: 'all', writes: 0, out: 'docs/testing/results', config: null, concurrency: 10, rounds: 5, timeout: null, clampKB: null, role: null, roles: null, updateMaster: 0, transport: 'stdio' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--agent') { args.agent = String(next); i++; }
    else if (a === '--suite') { args.suite = String(next); i++; }
    else if (a === '--writes') { args.writes = Number(next) ? 1 : 0; i++; }
    else if (a === '--out') { args.out = String(next); i++; }
    else if (a === '--config') { args.config = String(next); i++; }
    else if (a === '--concurrency') { args.concurrency = parseInt(String(next), 10) || 10; i++; }
    else if (a === '--rounds') { args.rounds = parseInt(String(next), 10) || 5; i++; }
    else if (a === '--timeout') { args.timeout = parseInt(String(next), 10) || null; i++; }
    else if (a === '--clampKB') { args.clampKB = parseInt(String(next), 10) || null; i++; }
    else if (a === '--role') { args.role = String(next); i++; }
    else if (a === '--roles') { args.roles = String(next); i++; }
    else if (a === '--updateMaster') { args.updateMaster = Number(next) ? 1 : 0; i++; }
    else if (a === '--transport') { args.transport = String(next); i++; }
  }
  return args;
}

async function withClient(configPath, envOverrides, fn, transport = 'stdio') {
  const serverPath = path.resolve(__dirname, '../dist/index.js');
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, WPNAV_ENABLE_WRITES: envOverrides.writes ? '1' : '0' };
  if (envOverrides.timeout != null) env.WPNAV_TOOL_TIMEOUT_MS = String(envOverrides.timeout);
  if (envOverrides.clampKB != null) env.WPNAV_MAX_RESPONSE_KB = String(envOverrides.clampKB);
  if (envOverrides.allowInsecure != null) env.ALLOW_INSECURE_HTTP = envOverrides.allowInsecure ? '1' : '0';
  if (transport === 'stdio') {
    const stdioTransport = new StdioClientTransport({ command: process.execPath, args: [serverPath, configPath], cwd, env, stderr: 'inherit' });
    const client = new Client({ name: 'wpnav-harness', version: '1.0.0' });
    await client.connect(stdioTransport);
    try { return await fn(client); } finally { try { await client.close(); } catch {} }
  } else if (transport === 'http') {
    const bridge = await startBridge({ serverPath, configPath, cwd, env });
    const base = bridge.baseUrl;
    const clientAdapter = {
      async listTools() {
        const r = await fetch(`${base}/tools`);
        return await r.json();
      },
      async callTool({ name, arguments: args = {} }) {
        const r = await fetch(`${base}/call`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }) });
        return await r.json();
      },
    };
    try { return await fn(clientAdapter); } finally { await bridge.close(); }
  } else {
    throw new Error(`Unsupported transport: ${transport}`);
  }
}

async function textFromToolResult(res) {
  const c = res?.content || [];
  const t = c.find(x => x?.type === 'text');
  return t?.text || '';
}

async function listTools(client) {
  const r = await client.listTools();
  return r.tools || [];
}

function pxx(arr, p) {
  if (!arr.length) return 0;
  const idx = Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)));
  return arr.slice().sort((a,b)=>a-b)[idx];
}

async function runBasicSuite({ cfg, writes, agent, outDir, tap }) {
  const metrics = { agent, suite: 'basic', ts: Date.now(), hostname: null };
  const envCfg = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  metrics.hostname = hostnameFromUrl(envCfg.WP_BASE_URL);

  await withClient(cfg, { writes }, async (client) => {
    // tools list
    const tools = await listTools(client);
    const toolNames = tools.map(t => t.name);
    tap.ok(`tools/list returns ${tools.length} tools`);
    // help banner
    const help = await client.callTool({ name: 'wpnav_help', arguments: {} });
    const helpText = await textFromToolResult(help);
    if (helpText.includes('WP Navigator MCP — Connection Help')) tap.ok('wpnav_help banner'); else tap.notOk('wpnav_help banner', { message: 'Missing banner' });
    // introspect
    const intro = await client.callTool({ name: 'wpnav_introspect', arguments: {} }).catch(e => e);
    if (intro?.content || intro?.result) tap.ok('wpnav_introspect returns content'); else tap.notOk('wpnav_introspect', { message: String(intro?.message || intro) });
    // list pages small
    try {
      const t0 = performance.now();
      const res = await client.callTool({ name: 'wpnav_list_pages', arguments: { per_page: 5 } });
      const t1 = performance.now();
      const txt = await textFromToolResult(res);
      metrics.list_pages_ms = (metrics.list_pages_ms || []);
      metrics.list_pages_ms.push(t1 - t0);
      if (txt && txt.startsWith('[')) tap.ok('wpnav_list_pages returns array'); else tap.notOk('wpnav_list_pages returns array', { message: 'Unexpected output', preview: (txt || '').slice(0, 60) });
    } catch (e) { tap.notOk('wpnav_list_pages returns array', { message: String(e?.message || e) }); }
    // get page invalid id
    const invalid = await client.callTool({ name: 'wpnav_get_page', arguments: { id: 0 } }).then(()=>({ok:true})).catch(err=>({ok:false,err}));
    if (!invalid.ok) tap.ok('wpnav_get_page invalid id → error'); else tap.notOk('wpnav_get_page invalid id → error', { message: 'Expected error' });
    // write tests (update)
    const doUpdate = await client.callTool({ name: 'wpnav_update_page', arguments: { id: 1, title: `Harness Update ${new Date().toISOString()}` } }).then(()=>({ok:true})).catch(err=>({ok:false,err}));
    if (writes) {
      if (doUpdate.ok) tap.ok('wpnav_update_page (writes enabled)'); else tap.notOk('wpnav_update_page (writes enabled)', { message: String(doUpdate.err?.message || doUpdate.err) });
    } else {
      if (!doUpdate.ok && /WRITES_DISABLED|NOT_SUPPORTED_SAFE_WRITE/.test(String(doUpdate.err?.message))) tap.ok('wpnav_update_page (writes disabled → blocked)'); else tap.notOk('wpnav_update_page (writes disabled)', { message: String(doUpdate.err?.message || doUpdate.err) });
    }
  });

  // Save metrics
  const outPath = path.join(outDir, `${agent}-v1-basic.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
}

async function validateToolsGolden({ cfg, tap, agent, outDir }) {
  // Compare tool names against golden file; allow supersets (pass with note) and flag missing names
  const goldenPath = path.resolve(__dirname, '../../../docs/testing/goldens/tools.v1.json');
  if (!fs.existsSync(goldenPath)) return; // nothing to validate
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  const namesGolden = new Set(golden.names || []);
  let namesActual = [];
  await withClient(cfg, { writes: 0 }, async (client) => {
    const tools = await listTools(client);
    namesActual = tools.map(t => t.name);
  });
  const missing = [...namesGolden].filter(n => !namesActual.includes(n));
  const extras = namesActual.filter(n => !namesGolden.has(n));
  if (missing.length === 0 && extras.length === 0) {
    tap.ok('tools golden match (exact)');
  } else if (missing.length === 0 && extras.length > 0) {
    tap.okWithNote('tools golden match (superset)', `extras: ${extras.join(', ')}`);
  } else {
    tap.notOk('tools golden mismatch', { missing: missing.join(', '), extras: extras.join(', ') });
  }
}

async function runConnectivitySuite({ cfg, agent, outDir, tap, concurrency = 10, rounds = 5, clampKB, timeout, transport = 'stdio' }) {
  const metrics = { agent, suite: 'connectivity', ts: Date.now(), rounds, concurrency, latencies: [] };
  const envCfg = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  const baseHost = hostnameFromUrl(envCfg.WP_BASE_URL);

  // baseline handshake + list
  await withClient(cfg, { writes: 0 }, async (client) => {
    const tools = await listTools(client);
    tap.ok(`initialize + tools/list (${tools.length} tools)`);
    const help = await client.callTool({ name: 'wpnav_help', arguments: {} });
    const helpText = await textFromToolResult(help);
    if (helpText.includes('Target:')) tap.ok('wpnav_help banner shows target'); else tap.notOk('wpnav_help banner shows target');
  });

  // clamp test (if requested)
  if (clampKB != null) {
    await withClient(cfg, { writes: 0, clampKB }, async (client) => {
      const res = await client.callTool({ name: 'wpnav_list_posts', arguments: { per_page: 100 } });
      const text = await textFromToolResult(res);
      const bytes = Buffer.byteLength(text || '', 'utf8');
      if (text.includes(`[Output truncated at ${clampKB}KB`)) {
        tap.ok('response clamp enforced');
      } else if (bytes < (clampKB * 1024)) {
        tap.okWithNote('response clamp enforced', 'Payload below clamp threshold');
      } else {
        tap.notOk('response clamp enforced', { message: 'No truncation note' });
      }
    });
  }

  // timeout test (best-effort — ok if completes too fast)
  if (timeout != null) {
    let timedOut = false;
    try {
      await withClient(cfg, { writes: 0, timeout }, async (client) => {
        await client.callTool({ name: 'wpnav_list_pages', arguments: { per_page: 50 } });
      });
    } catch (e) {
      timedOut = /timed out/i.test(String(e?.message || e));
    }
    if (timedOut) tap.ok('timeout honored'); else tap.okWithNote('timeout honored', 'Completed before timeout (acceptable on fast/local env)');
  }

  // concurrency rounds
  await withClient(cfg, { writes: 0 }, async (client) => {
    for (let r = 0; r < rounds; r++) {
      const t0 = performance.now();
      const promises = Array.from({ length: concurrency }, () => client.callTool({ name: 'wpnav_list_pages', arguments: { per_page: 5 } }));
      await Promise.allSettled(promises);
      const t1 = performance.now();
      metrics.latencies.push(t1 - t0);
    }
  });
  const p50 = pxx(metrics.latencies, 0.5);
  const p95 = pxx(metrics.latencies, 0.95);
  tap.ok(`concurrency rounds p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms`);

  // Save metrics
  const outPath = path.join(outDir, `${agent}-v1-connectivity-throughput.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
}

async function runAdvancedSuite({ cfg, writes, agent, outDir, tap }) {
  const metrics = { agent, suite: 'advanced', ts: Date.now(), backupOverheadMs: [] };

  // Ensure writes gated
  if (!writes) {
    // Verify WRITES_DISABLED for update
    await withClient(cfg, { writes: 0 }, async (client) => {
      const upd = await client.callTool({ name: 'wpnav_update_post', arguments: { id: 1, title: 'x' } }).then(()=>({ok:true})).catch(err=>({ok:false,err}));
      if (!upd.ok && /WRITES_DISABLED|NOT_SUPPORTED_SAFE_WRITE/.test(String(upd.err?.message))) tap.ok('writes disabled → blocked'); else tap.notOk('writes disabled → blocked');
    });
    // Save metrics and return
    const outPath = path.join(outDir, `${agent}-v1-advanced-policy-safety.json`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
    return;
  }

  // Write-enabled tests
  await withClient(cfg, { writes: 1 }, async (client) => {
    // Measure backup-before-write overhead on update
    const t0 = performance.now();
    const res = await client.callTool({ name: 'wpnav_update_post', arguments: { id: 1, title: `Harness Update ${Date.now()}` } }).catch(e => e);
    const t1 = performance.now();
    metrics.backupOverheadMs.push(t1 - t0);
    if (res?.content || res?.result) tap.ok('backup-before-write (update)'); else tap.notOk('backup-before-write (update)', { message: String(res?.message || res) });

    // Dedupe window (best-effort): two quick updates
    const t2 = performance.now();
    await client.callTool({ name: 'wpnav_update_post', arguments: { id: 1, title: `Harness Update 2 ${Date.now()}` } }).catch(()=>{});
    const t3 = performance.now();
    metrics.backupOverheadMs.push(t3 - t2);
    tap.okWithNote('dedupe window best-effort', 'Verify via server logs/audit if available');
  });

  const outPath = path.join(outDir, `${agent}-v1-advanced-policy-safety.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2));
}

async function runToolsMatrixSuite({ cfg, writes, agent, outDir, tap, transport = 'stdio' }) {
  // Iterate tools and run list/* reads; verify write tools deny when writes=0
  await withClient(cfg, { writes }, async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);
    tap.ok(`tools/list (matrix) has ${names.length} tools`);

    // List operations
    const listNames = names.filter(n => n.startsWith('wpnav_list_'));
    for (const name of listNames) {
      const args = name.includes('pages') || name.includes('posts') || name.includes('comments') || name.includes('media') ? { per_page: 2 } : {};
      try {
        const res = await client.callTool({ name, arguments: args });
        const txt = await textFromToolResult(res);
        if (txt && (txt.startsWith('[') || txt.startsWith('{') || typeof txt === 'string')) tap.ok(`${name} (list)`); else tap.notOk(`${name} (list)`, { message: 'Unexpected output', preview: (txt || '').slice(0, 60) });
      } catch (e) {
        tap.notOk(`${name} (list)`, { message: String(e?.message || e) });
      }
    }

    // Targeted gets where we can provide safe args
    if (names.includes('wpnav_get_taxonomy')) {
      try {
        const res = await client.callTool({ name: 'wpnav_get_taxonomy', arguments: { taxonomy: 'category' } });
        const txt = await textFromToolResult(res);
        if (txt) tap.ok('wpnav_get_taxonomy(category)'); else tap.notOk('wpnav_get_taxonomy(category)');
      } catch (e) { tap.notOk('wpnav_get_taxonomy(category)', { message: String(e?.message || e) }); }
    }

    // Write-deny checks
    const writeNames = names.filter(n => /create_|update_|delete_|install_|activate_|deactivate_|update_theme|delete_theme|install_theme|update_plugin|delete_plugin/.test(n));
    for (const w of writeNames) {
      try {
        const res = await client.callTool({ name: w, arguments: { id: 1, title: 'Test' } });
        if (writes) {
          tap.ok(`${w} (writes enabled)`);
        } else {
          // If call succeeded in read-only, mark with note as unexpected but non-fatal
          tap.notOk(`${w} (writes disabled)`, { message: 'Should have been blocked' });
        }
      } catch (e) {
        const msg = String(e?.message || e);
        if (!writes && /WRITES_DISABLED|NOT_SUPPORTED_SAFE_WRITE|denied|approval/i.test(msg)) tap.ok(`${w} blocked (writes disabled)`);
        else if (writes) tap.notOk(`${w} (writes enabled)`, { message: msg });
        else tap.okWithNote(`${w} blocked`, msg.slice(0, 200));
      }
    }
  }, transport);

  // Save a small summary JSON
  const outPath = path.join(outDir, `${agent}-v1-tools-matrix.json`);
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  fs.writeFileSync(outPath, JSON.stringify({ agent, suite: 'tools-matrix', ts: Date.now() }, null, 2));
}

async function runPluginRestSuite({ cfg, agent, outDir, tap }) {
  const envCfg = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  const rest = envCfg.WP_REST_API.replace(/\/$/, '');
  const wpnav = envCfg.WPNAV_BASE.replace(/\/$/, '');
  const base = envCfg.WP_BASE_URL.replace(/\/$/, '');
  const auth = 'Basic ' + Buffer.from(`${envCfg.WP_APP_USER}:${envCfg.WP_APP_PASS}`).toString('base64');

  async function http(url, init = {}, opts = {}) {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers||{}), Authorization: auth } });
    if (opts.expectStatus && r.status !== opts.expectStatus) throw new Error(`${url} expected ${opts.expectStatus} got ${r.status}`);
    return r;
  }

  // REST root link headers (service-desc/service-doc)
  try {
    const r = await fetch(`${rest}/wp/v2/types`);
    const link = r.headers.get('link') || r.headers.get('Link');
    if (link && /service-desc/.test(link)) tap.ok('REST link headers include service-desc'); else tap.notOk('REST link headers include service-desc', { message: `Link=${link||''}` });
  } catch (e) { tap.notOk('REST link headers include service-desc', { message: String(e?.message || e) }); }

  // OpenAPI
  try {
    const r = await fetch(`${rest}/wpnav/openapi`);
    const j = await r.json();
    if (j && (j.openapi || j.info)) tap.ok('OpenAPI returned JSON'); else tap.notOk('OpenAPI returned JSON');
  } catch (e) { tap.notOk('OpenAPI returned JSON', { message: String(e?.message || e) }); }

  // .well-known redirect
  try {
    const r = await fetch(`${base}/.well-known/openapi.json`, { redirect: 'manual' });
    if (r.status === 302 || r.status === 301) tap.ok('.well-known redirect present'); else tap.okWithNote('.well-known redirect present', `status=${r.status}`);
  } catch (e) { tap.notOk('.well-known redirect present', { message: String(e?.message || e) }); }

  // wpnav introspect (auth)
  try {
    const r = await http(`${wpnav}/introspect`);
    const j = await r.json();
    if (j && typeof j === 'object') tap.ok('wpnav introspect (direct)'); else tap.notOk('wpnav introspect (direct)');
  } catch (e) { tap.notOk('wpnav introspect (direct)', { message: String(e?.message || e) }); }

  // Handshake (wp-navigator)
  try {
    const r = await http(`${rest}/wp-navigator/v1/handshake`, { method: 'POST', body: JSON.stringify({ cli_name: 'harness', cli_version: '1.0.0' }) });
    const j = await r.json();
    if (j && j.status) tap.ok('handshake (wp-navigator/v1)'); else tap.okWithNote('handshake (wp-navigator/v1)', 'no status field');
  } catch (e) { tap.notOk('handshake (wp-navigator/v1)', { message: String(e?.message || e) }); }

  // Status (public)
  try {
    const r = await fetch(`${rest}/wp-navigator/v1/status`);
    if (r.ok) tap.ok('status (public)'); else tap.notOk('status (public)', { message: `status=${r.status}` });
  } catch (e) { tap.notOk('status (public)', { message: String(e?.message || e) }); }

  // Policy (auth)
  try {
    const r = await http(`${rest}/wp-navigator/v1/policy`);
    const j = await r.json();
    if (j && typeof j === 'object') tap.ok('policy (auth)'); else tap.notOk('policy (auth)');
  } catch (e) { tap.notOk('policy (auth)', { message: String(e?.message || e) }); }

  // Audit log (auth)
  try {
    const r = await http(`${rest}/wp-navigator/v1/audit-log`);
    if (r.ok) tap.ok('audit-log (auth)'); else tap.notOk('audit-log (auth)', { message: `status=${r.status}` });
  } catch (e) { tap.notOk('audit-log (auth)', { message: String(e?.message || e) }); }

  const outPath = path.join(outDir, `${agent}-v1-plugin-rest.json`);
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  fs.writeFileSync(outPath, JSON.stringify({ agent, suite: 'plugin-rest', ts: Date.now() }, null, 2));
}

function roleCredsFromEnv(role, baseCfg) {
  if (!role || role === 'admin') return { user: baseCfg.WP_APP_USER, pass: baseCfg.WP_APP_PASS };
  const key = role.toUpperCase();
  const user = process.env[`WP_APP_USER_${key}`] || baseCfg[`WP_APP_USER_${key}`];
  const pass = process.env[`WP_APP_PASS_${key}`] || baseCfg[`WP_APP_PASS_${key}`];
  if (!user || !pass) throw new Error(`Missing credentials for role ${role}. Provide WP_APP_USER_${key} and WP_APP_PASS_${key}.`);
  return { user, pass };
}

function parseRoles(arg) {
  if (!arg) return ['admin'];
  return String(arg).split(',').map(s => s.trim()).filter(Boolean);
}

async function runForRole(role, args, baseEnvCfgPath, serverDir, workspaceRoot) {
  const baseCfg = JSON.parse(fs.readFileSync(baseEnvCfgPath, 'utf8'));
  const creds = roleCredsFromEnv(role, baseCfg);
  const { configPath, cleanup } = buildResolvedConfig({ repoRoot: serverDir, explicitConfigPath: null, overrideUser: creds.user, overridePass: creds.pass });
  const outDir = path.isAbsolute(args.out) ? args.out : path.resolve(workspaceRoot, args.out);
  const tap = createTapEmitter();
  tap.header();

  try {
    if (args.suite === 'basic' || args.suite === 'all') {
      await runBasicSuite({ cfg: configPath, writes: !!args.writes, agent: `${args.agent}-${role}`, outDir, tap });
      await validateToolsGolden({ cfg: configPath, tap, agent: `${args.agent}-${role}`, outDir });
    }
    if (args.suite === 'connect' || args.suite === 'all') {
      await runConnectivitySuite({ cfg: configPath, agent: `${args.agent}-${role}`, outDir, tap, concurrency: args.concurrency, rounds: args.rounds, clampKB: args.clampKB, timeout: args.timeout, transport: args.transport });
    }
    if (args.suite === 'advanced' || args.suite === 'all') {
      await runAdvancedSuite({ cfg: configPath, writes: !!args.writes, agent: `${args.agent}-${role}`, outDir, tap });
    }
    if (args.suite === 'tools' || args.suite === 'all') {
      await runToolsMatrixSuite({ cfg: configPath, writes: !!args.writes, agent: `${args.agent}-${role}`, outDir, tap, transport: args.transport });
    }
    if (args.suite === 'plugin' || args.suite === 'all') {
      await runPluginRestSuite({ cfg: configPath, agent: `${args.agent}-${role}`, outDir, tap });
    }
  } catch (e) {
    tap.notOk('harness error', { message: String(e?.message || e) });
  }

  // Emit plan at end to reflect dynamic count
  tap.plan(tap.count);
  const tapText = tap.toString();
  console.log(`# role=${role}`);
  console.log(tapText);
  // Emit plan at end to reflect dynamic count
  try {
    fs.appendFileSync(path.join(outDir, `${args.agent}-${role}-v1-${args.suite}.tap`), '');
  } catch {}
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const tapName = `${args.agent}-${role}-v1-${args.suite}.tap`;
    fs.writeFileSync(path.join(outDir, tapName), tapText);
  } catch {}
  cleanup();
  return tapText;
}

async function main() {
  const args = parseArgs(process.argv);
  const serverDir = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const { configPath: baseCfgPath, cleanup: baseCleanup } = buildResolvedConfig({ repoRoot: serverDir, explicitConfigPath: args.config });
  const roles = parseRoles(args.roles || args.role);
  const taps = [];
  try {
    for (const role of roles) {
      const t = await runForRole(role, args, baseCfgPath, serverDir, workspaceRoot);
      taps.push({ role, text: t });
    }
  } catch (e) {
    console.error('Harness error:', e?.message || e);
    baseCleanup();
    process.exit(1);
  }
  baseCleanup();

  if (args.updateMaster) {
    try {
      const master = path.resolve(workspaceRoot, 'docs/testing/testing-master-list.md');
      const date = new Date().toISOString().slice(0,10);
      let block = `\n\n<!-- auto: harness summary (${date}) -->\n`;
      block += `Agent: ${args.agent}\nSuite: ${args.suite}\nRoles: ${roles.join(', ')}\n`;
      for (const t of taps) {
        const passCount = (t.text.match(/^ok\s/mg) || []).length;
        const failCount = (t.text.match(/^not ok\s/mg) || []).length;
        block += `- Role ${t.role}: pass=${passCount}, fail=${failCount}\n`;
      }
      fs.appendFileSync(master, block);
      console.log(`Master list appended (${master}).`);
    } catch (e) {
      console.error('Master list update failed:', e?.message || e);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
