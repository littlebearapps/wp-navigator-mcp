import fs from 'fs';
import os from 'os';
import path from 'path';

export function buildResolvedConfig({ repoRoot, explicitConfigPath, overrideUser, overridePass } = {}) {
  // If an explicit JSON config is given, use it as-is
  if (explicitConfigPath && fs.existsSync(explicitConfigPath)) {
    return { configPath: explicitConfigPath, cleanup: () => {} };
  }
  const envPath = path.resolve(repoRoot || process.cwd(), '../../.local-wp.env');
  const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const kv = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('#')) continue;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
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
    WP_APP_USER: overrideUser || appUser,
    WP_APP_PASS: overridePass || appPass,
  };
  const cfgPath = path.join(os.tmpdir(), `wpnav-harness-${Date.now()}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  return {
    configPath: cfgPath,
    cleanup: () => { try { fs.unlinkSync(cfgPath); } catch {} },
  };
}

export function hostnameFromUrl(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
