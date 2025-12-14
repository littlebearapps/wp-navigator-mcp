#!/usr/bin/env node
/*
 * wp-navigator-setup — Cross-CLI Setup Wizard (STDIO)
 *
 * Generates client config blocks for Claude Code (JSON), Codex CLI (TOML),
 * and Gemini CLI (JSON). Optionally writes them to standard locations with a
 * timestamped backup. Defaults to dry-run with console output.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Client = 'claude' | 'codex' | 'gemini' | 'all';

function argvFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function argvValue(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}

function loadLocalEnv(envPath?: string) {
  const p = envPath || path.resolve(process.cwd(), '../../.local-wp.env');
  if (!fs.existsSync(p)) return {} as Record<string, string>;
  const txt = fs.readFileSync(p, 'utf8');
  const out: Record<string, string> = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function redact(s?: string) {
  if (!s) return '';
  return s.length <= 4 ? '****' : `${s.slice(0, 2)}****${s.slice(-2)}`;
}

function absoluteServerPath(): string {
  // point to built dist/index.js
  const here = path.resolve(__dirname);
  const entry = path.resolve(here, 'index.js');
  return entry;
}

function buildEnvBlock(env: Record<string, string>) {
  const keys = [
    'WP_BASE_URL',
    'WP_REST_API',
    'WPNAV_BASE',
    'WPNAV_INTROSPECT',
    'WP_APP_USER',
    'WP_APP_PASS',
  ];
  const out: Record<string, string> = {};
  for (const k of keys) if (env[k]) out[k] = env[k];
  return out;
}

function claudeConfig(env: Record<string, string>) {
  const abs = absoluteServerPath();
  return {
    mcpServers: {
      wpnavigator: {
        command: 'node',
        args: [abs],
        env: buildEnvBlock(env),
      },
    },
  };
}

function codexToml(env: Record<string, string>) {
  const abs = absoluteServerPath();
  const E = buildEnvBlock(env);
  const envLines = Object.entries(E)
    .map(([k, v]) => `${k} = "${v.replace(/"/g, '\\"')}"`) // naive TOML string escaping
    .join('\n');
  return `
[mcp_servers.wpnavigator]
command = "node"
args    = ["${abs.replace(/"/g, '\\"')}"]
startup_timeout_sec = 30
tool_timeout_sec    = 600
enabled = true

[mcp_servers.wpnavigator.env]
${envLines}
`.trimStart();
}

function geminiConfig(env: Record<string, string>) {
  const abs = absoluteServerPath();
  return {
    mcpServers: {
      wpnavigator: {
        command: 'node',
        args: [abs],
        env: buildEnvBlock(env),
      },
    },
  };
}

function writeWithBackup(targetPath: string, contents: string) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bak = `${targetPath}.${stamp}.bak`;
    fs.copyFileSync(targetPath, bak);
    console.error(`Backup written: ${bak}`);
  }
  fs.writeFileSync(targetPath, contents);
  console.error(`Updated: ${targetPath}`);
}

function main() {
  const client = (argvValue('client', 'all') as Client) || 'all';
  const dryRun = argvFlag('dry-run') || !argvFlag('write');
  const envPath = argvValue('env');
  const verify = argvFlag('verify');
  const target = argvValue('path');

  const env = { ...process.env, ...loadLocalEnv(envPath) } as Record<string, string>;
  const E = buildEnvBlock(env);

  console.log('WP Navigator MCP — Setup Wizard (STDIO)');
  console.log(`Client: ${client}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`);
  console.log(
    `Env: WP_BASE_URL=${E.WP_BASE_URL || ''}, WP_APP_USER=${E.WP_APP_USER || ''}, WP_APP_PASS=${redact(E.WP_APP_PASS)}`
  );
  console.log('');

  const home = os.homedir();
  const claudePath = path.join(
    home,
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json'
  );
  const codexPath = path.join(home, '.codex', 'config.toml');
  const geminiPath = path.join(home, '.gemini', 'mcp.json'); // placeholder; may vary by build

  const wantClaude = client === 'claude' || client === 'all';
  const wantCodex = client === 'codex' || client === 'all';
  const wantGemini = client === 'gemini' || client === 'all';

  if (wantClaude) {
    const cfg = claudeConfig(env);
    const json = JSON.stringify(cfg, null, 2);
    console.log('--- Claude Code (JSON) ---');
    console.log(json);
    if (!dryRun) {
      const p = target && client === 'claude' ? target : claudePath;
      // Merge strategy: if file exists and has mcpServers, merge/overwrite wpnavigator; else write minimal file
      let finalCfg: any = cfg;
      if (fs.existsSync(p)) {
        try {
          const existing = JSON.parse(fs.readFileSync(p, 'utf8'));
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.wpnavigator = cfg.mcpServers.wpnavigator;
          finalCfg = existing;
        } catch {
          // fall through to overwrite
        }
      }
      writeWithBackup(p, JSON.stringify(finalCfg, null, 2));
    }
    console.log('');
  }

  if (wantCodex) {
    const toml = codexToml(env);
    console.log('--- Codex CLI (TOML) ---');
    console.log(toml);
    if (!dryRun) {
      const p = target && client === 'codex' ? target : codexPath;
      let merged = toml;
      if (fs.existsSync(p)) {
        const current = fs.readFileSync(p, 'utf8');
        if (!current.includes('[mcp_servers.wpnavigator]')) {
          merged = current.trimEnd() + '\n\n' + toml + '\n';
        } else {
          // naive replace: leave existing as-is to avoid clobbering; print guidance
          console.error('Note: Existing wpnavigator section found; not overwritten.');
          merged = current;
        }
      }
      writeWithBackup(p, merged);
    }
    console.log('');
  }

  if (wantGemini) {
    const cfg = geminiConfig(env);
    const json = JSON.stringify(cfg, null, 2);
    console.log('--- Gemini CLI (JSON) ---');
    console.log(json);
    if (!dryRun) {
      const p = target && client === 'gemini' ? target : geminiPath;
      // Same merge strategy as Claude
      let finalCfg: any = cfg;
      if (fs.existsSync(p)) {
        try {
          const existing = JSON.parse(fs.readFileSync(p, 'utf8'));
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.wpnavigator = cfg.mcpServers.wpnavigator;
          finalCfg = existing;
        } catch {
          // overwrite
        }
      }
      writeWithBackup(p, JSON.stringify(finalCfg, null, 2));
    }
    console.log('');
  }

  if (verify) {
    const abs = absoluteServerPath();
    console.log('Verification:');
    console.log(`npx @modelcontextprotocol/inspector -- node ${abs}`);
  }
}

main();
