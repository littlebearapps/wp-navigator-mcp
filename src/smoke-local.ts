import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const __dirname = path.dirname(new URL(import.meta.url).pathname);

type RpcMsg = any;

function send(proc: any, msg: RpcMsg) {
  const line = JSON.stringify(msg);
  proc.stdin.write(line + '\n');
}

function readLines(stream: NodeJS.ReadableStream, onLine: (l: string) => void) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) onLine(line);
    }
  });
}

async function run() {
  const serverPath = path.resolve(__dirname, 'index.js');
  const live = process.env.SMOKE_LIVE === '1';
  const liveConfig = process.env.SMOKE_CONFIG || '';

  let args: string[] = [serverPath];
  let cfgPath: string | undefined;
  if (!live || liveConfig) {
    // Build a temporary config JSON with dummy values (no network usage)
    if (liveConfig && fs.existsSync(liveConfig)) {
      cfgPath = liveConfig;
    } else if (!live) {
      const cfg = {
        WP_BASE_URL: 'http://localhost:8888',
        WP_REST_API: 'http://localhost:8888/wp-json',
        WPNAV_BASE: 'http://localhost:8888/wp-json/wpnav/v1',
        WPNAV_INTROSPECT: 'http://localhost:8888/wp-json/wpnav/v1/introspect',
        WP_APP_USER: 'admin',
        WP_APP_PASS: 'password',
      };
      cfgPath = path.join(os.tmpdir(), `wp-navigator-test-${Date.now()}.json`);
      fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    }
    args = [serverPath, cfgPath!];
  }

  const proc = spawn(process.execPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (d) => {
    // echo server logs to console for visibility
    process.stderr.write(d);
  });

  let nextId = 1;
  const pending = new Map<number, (resp: any) => void>();

  readLines(proc.stdout, (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const res = pending.get(msg.id)!;
        pending.delete(msg.id);
        res(msg);
      }
    } catch (e) {
      console.error('Parse error:', e, 'line=', line);
    }
  });

  function rpc(method: string, params?: any): Promise<any> {
    const id = nextId++;
    const msg = { jsonrpc: '2.0', id, method, params };
    send(proc, msg);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timeout waiting for ${method} (id=${id})`));
      }, 5000);
      pending.set(id, (resp) => {
        clearTimeout(t);
        resolve(resp);
      });
    });
  }

  // Initialize
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    clientInfo: { name: 'smoke-local', version: '0.0.1' },
  });
  console.log('initialize → ok');

  // List tools
  const list = await rpc('tools/list');
  const toolCount = Array.isArray(list.result?.tools) ? list.result.tools.length : 0;
  console.log(`tools/list → ${toolCount} tools`);

  // Call help
  const help = await rpc('tools/call', { name: 'wpnav_help', arguments: {} });
  const helpText = help.result?.content?.[0]?.text || '';
  if (!String(helpText).includes('WP Navigator MCP — Connection Help')) {
    throw new Error('help did not return expected banner');
  }
  console.log('tools/call(wpnav_help) → ok');

  // Call help and an update (writes disabled → should error before network)
  const upd = await rpc('tools/call', {
    name: 'wpnav_update_page',
    arguments: { id: 123, title: 'Hello' },
  });
  const updIsError = !!upd.error || !!upd.result?.isError;
  const errText = upd.error?.message || upd.result?.content?.[0]?.text || '';
  if (!updIsError || !String(errText).includes('WRITES_DISABLED')) {
    throw new Error('update did not produce WRITES_DISABLED error');
  }
  console.log('tools/call(wpnav_update_page) → WRITES_DISABLED (expected)');

  if (live) {
    // Live tests against WordPress: introspect + list pages
    const intro = await rpc('tools/call', { name: 'wpnav_introspect', arguments: {} });
    const introText = intro.result?.content?.[0]?.text || '';
    if (!introText || typeof introText !== 'string' || !introText.includes('plugin')) {
      throw new Error('introspect returned unexpected result');
    }
    console.log('tools/call(wpnav_introspect) → ok');

    const pages = await rpc('tools/call', { name: 'wpnav_list_pages', arguments: { per_page: 2 } });
    const pagesText = pages.result?.content?.[0]?.text || '';
    if (!pagesText || typeof pagesText !== 'string') {
      throw new Error('list_pages returned unexpected result');
    }
    console.log('tools/call(wpnav_list_pages) → ok');
  }

  proc.kill();
  if (cfgPath && fs.existsSync(cfgPath) && cfgPath.includes('wp-navigator-test-'))
    fs.unlinkSync(cfgPath);
  console.log('Smoke tests passed.');
}

run().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
