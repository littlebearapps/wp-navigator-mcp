import { redact } from './config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

function ts() {
  return new Date().toISOString();
}

function fmt(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export const logger = {
  debug(msg: string, meta?: Record<string, any>) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(`[${ts()}] DEBUG ${msg}${meta ? ' ' + fmt(redactMeta(meta)) : ''}`);
    }
  },
  info(msg: string, meta?: Record<string, any>) {
    console.error(`[${ts()}] INFO  ${msg}${meta ? ' ' + fmt(redactMeta(meta)) : ''}`);
  },
  warn(msg: string, meta?: Record<string, any>) {
    console.error(`[${ts()}] WARN  ${msg}${meta ? ' ' + fmt(redactMeta(meta)) : ''}`);
  },
  error(msg: string, meta?: Record<string, any>) {
    console.error(`[${ts()}] ERROR ${msg}${meta ? ' ' + fmt(redactMeta(meta)) : ''}`);
  },
};

function redactMeta(meta: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k.toLowerCase().includes('password') || k.toLowerCase().includes('authorization') || k.toLowerCase().includes('token')) {
      out[k] = redact(String(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

