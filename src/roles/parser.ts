/**
 * WP Navigator Role Parser
 *
 * Phase B3: YAML parsing and validation for role definitions.
 * Supports both YAML and JSON formats for flexibility.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as yamlParse } from 'yaml';
import {
  Role,
  RoleSource,
  LoadedRole,
  RoleLoadResult,
  RoleValidationError,
  RoleSchemaVersionError,
  ROLE_SCHEMA_VERSION,
} from './types.js';

// =============================================================================
// YAML Parser (using 'yaml' library)
// =============================================================================

/**
 * Parse a YAML string into an object.
 * Uses the 'yaml' library for full YAML 1.2 compliance.
 */
export function parseYaml(content: string): Record<string, unknown> {
  const result = yamlParse(content);
  return result ?? {};
}

// =============================================================================
// Role Validation
// =============================================================================

/**
 * Validate role name format (slug)
 */
function isValidRoleName(name: string): boolean {
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) || /^[a-z]$/.test(name);
}

/**
 * Validate a parsed role object
 */
export function validateRole(data: unknown, filePath: string): Role {
  if (!data || typeof data !== 'object') {
    throw new RoleValidationError('Role must be a YAML/JSON object', filePath);
  }

  const obj = data as Record<string, unknown>;

  // Validate schema_version if present
  if (obj.schema_version !== undefined) {
    if (typeof obj.schema_version !== 'number' || !Number.isInteger(obj.schema_version)) {
      throw new RoleSchemaVersionError(
        `Invalid schema_version: expected integer, got ${typeof obj.schema_version}`,
        filePath,
        'Set "schema_version: 1" (must be an integer).'
      );
    }

    if (obj.schema_version > ROLE_SCHEMA_VERSION) {
      throw new RoleSchemaVersionError(
        `Unsupported role schema_version: ${obj.schema_version}`,
        filePath,
        `This version of wpnav only understands role schema_version ${ROLE_SCHEMA_VERSION}.\n\nUpgrade wpnav to use this role.`
      );
    }
  }

  // Validate name (required)
  if (!obj.name || typeof obj.name !== 'string') {
    throw new RoleValidationError(
      'Missing or invalid "name" field (required string)',
      filePath,
      'name'
    );
  }

  if (!isValidRoleName(obj.name)) {
    throw new RoleValidationError(
      `Invalid role name "${obj.name}": must be lowercase slug format (e.g., "content-editor")`,
      filePath,
      'name'
    );
  }

  // Validate description (required)
  if (!obj.description || typeof obj.description !== 'string') {
    throw new RoleValidationError(
      'Missing or invalid "description" field (required string)',
      filePath,
      'description'
    );
  }

  // Validate context (required)
  if (!obj.context || typeof obj.context !== 'string') {
    throw new RoleValidationError(
      'Missing or invalid "context" field (required string)',
      filePath,
      'context'
    );
  }

  // Validate focus_areas (optional, array of strings)
  if (obj.focus_areas !== undefined) {
    if (!Array.isArray(obj.focus_areas)) {
      throw new RoleValidationError('focus_areas must be an array', filePath, 'focus_areas');
    }
    for (let i = 0; i < obj.focus_areas.length; i++) {
      if (typeof obj.focus_areas[i] !== 'string') {
        throw new RoleValidationError(
          `focus_areas[${i}] must be a string`,
          filePath,
          `focus_areas[${i}]`
        );
      }
    }
  }

  // Validate avoid (optional, array of strings)
  if (obj.avoid !== undefined) {
    if (!Array.isArray(obj.avoid)) {
      throw new RoleValidationError('avoid must be an array', filePath, 'avoid');
    }
    for (let i = 0; i < obj.avoid.length; i++) {
      if (typeof obj.avoid[i] !== 'string') {
        throw new RoleValidationError(`avoid[${i}] must be a string`, filePath, `avoid[${i}]`);
      }
    }
  }

  // Validate tools (optional, object with allowed/denied arrays)
  if (obj.tools !== undefined) {
    if (typeof obj.tools !== 'object' || obj.tools === null) {
      throw new RoleValidationError('tools must be an object', filePath, 'tools');
    }

    const tools = obj.tools as Record<string, unknown>;

    if (tools.allowed !== undefined) {
      if (!Array.isArray(tools.allowed)) {
        throw new RoleValidationError('tools.allowed must be an array', filePath, 'tools.allowed');
      }
      for (let i = 0; i < tools.allowed.length; i++) {
        if (typeof tools.allowed[i] !== 'string') {
          throw new RoleValidationError(
            `tools.allowed[${i}] must be a string`,
            filePath,
            `tools.allowed[${i}]`
          );
        }
      }
    }

    if (tools.denied !== undefined) {
      if (!Array.isArray(tools.denied)) {
        throw new RoleValidationError('tools.denied must be an array', filePath, 'tools.denied');
      }
      for (let i = 0; i < tools.denied.length; i++) {
        if (typeof tools.denied[i] !== 'string') {
          throw new RoleValidationError(
            `tools.denied[${i}] must be a string`,
            filePath,
            `tools.denied[${i}]`
          );
        }
      }
    }
  }

  // Validate priority (optional, number)
  if (obj.priority !== undefined && typeof obj.priority !== 'number') {
    throw new RoleValidationError('priority must be a number', filePath, 'priority');
  }

  // Validate version (optional, string)
  if (obj.version !== undefined && typeof obj.version !== 'string') {
    throw new RoleValidationError('version must be a string', filePath, 'version');
  }

  // Validate tags (optional, array of strings)
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      throw new RoleValidationError('tags must be an array', filePath, 'tags');
    }
    for (let i = 0; i < obj.tags.length; i++) {
      if (typeof obj.tags[i] !== 'string') {
        throw new RoleValidationError(`tags[${i}] must be a string`, filePath, `tags[${i}]`);
      }
    }
  }

  // Validate author (optional, string)
  if (obj.author !== undefined && typeof obj.author !== 'string') {
    throw new RoleValidationError('author must be a string', filePath, 'author');
  }

  return obj as unknown as Role;
}

// =============================================================================
// Role File Loading
// =============================================================================

/**
 * Load a role from a YAML or JSON file
 */
export function loadRoleFile(filePath: string, source: RoleSource): RoleLoadResult {
  const ext = path.extname(filePath).toLowerCase();

  // Read file
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    };
  }

  // Parse based on extension
  let parsed: unknown;
  try {
    if (ext === '.json') {
      parsed = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      parsed = parseYaml(content);
    } else {
      return {
        success: false,
        error: `Unsupported file extension: ${ext} (use .yaml, .yml, or .json)`,
        path: filePath,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse ${ext}: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    };
  }

  // Validate
  try {
    const role = validateRole(parsed, filePath);
    const loadedRole: LoadedRole = {
      ...role,
      source,
      sourcePath: filePath,
    };
    return {
      success: true,
      role: loadedRole,
      path: filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path: filePath,
    };
  }
}
