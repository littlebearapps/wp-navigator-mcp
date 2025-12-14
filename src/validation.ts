import { tools } from './tools.js';

type JSONSchema = any;

const schemaByTool: Record<string, JSONSchema | undefined> = Object.create(null);
for (const t of tools as Array<any>) {
  if (t?.name) schemaByTool[t.name] = t.inputSchema;
}

/**
 * Lightweight JSON-schema-like validator for tool args.
 * - Enforces required fields
 * - Applies defaults
 * - Removes additional properties
 * - Performs basic type checks for string/number/boolean
 *
 * This is a stop-gap until Ajv is wired (no runtime dependency required).
 */
export function validateArgsForTool(toolName: string, args: any): any {
  const schema = schemaByTool[toolName];
  if (!schema || schema.type !== 'object' || !schema.properties) return args ?? {};

  const input = args && typeof args === 'object' ? { ...args } : {};
  const out: Record<string, any> = {};
  const props: Record<string, any> = schema.properties || {};

  // Apply defaults and coerce known props
  for (const key of Object.keys(props)) {
    const def = props[key];
    let value = input.hasOwnProperty(key) ? input[key] : undefined;
    if (value === undefined && def && def.default !== undefined) {
      value = def.default;
    }
    if (value !== undefined) {
      const ok = basicTypeCheck(def?.type, value, def?.enum);
      if (ok) out[key] = value;
    }
  }

  // Validate required
  const required: string[] = Array.isArray(schema.required) ? schema.required : [];
  const missing = required.filter((k) => out[k] === undefined);
  if (missing.length) {
    throw new Error(`Invalid arguments for ${toolName}: missing required ${missing.join(', ')}`);
  }

  return out;
}

function basicTypeCheck(type: string | undefined, val: any, enumVals?: any[]): boolean {
  if (enumVals && Array.isArray(enumVals)) {
    if (!enumVals.includes(val)) return false;
  }
  switch (type) {
    case 'string':
      return typeof val === 'string';
    case 'number':
      return typeof val === 'number' && Number.isFinite(val);
    case 'integer':
      return typeof val === 'number' && Number.isInteger(val);
    case 'boolean':
      return typeof val === 'boolean';
    case 'object':
      return val && typeof val === 'object' && !Array.isArray(val);
    case 'array':
      return Array.isArray(val);
    default:
      return true; // if unspecified, accept
  }
}
