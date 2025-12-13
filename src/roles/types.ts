/**
 * WP Navigator Roles Types
 *
 * Type definitions for the roles system.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

/**
 * Current role schema version
 */
export const ROLE_SCHEMA_VERSION = 1;

/**
 * Source of a role definition
 */
export type RoleSource = 'project' | 'builtin' | 'api' | 'global' | 'bundled';

/**
 * Role source constants (for use as values in code)
 */
export const RoleSource = {
  PROJECT: 'project' as const,
  BUILTIN: 'builtin' as const,
  BUNDLED: 'bundled' as const,
  API: 'api' as const,
  GLOBAL: 'global' as const,
};

/**
 * Role definition
 */
export interface Role {
  name: string;
  description: string;
  context: string;
  schema_version?: number;
  focus_areas?: string[];
  avoid?: string[];
  tools?: {
    allowed?: string[];
    denied?: string[];
  };
  priority?: number;
  version?: string;
  tags?: string[];
  author?: string;
}

/**
 * Loaded role with source information
 */
export interface LoadedRole extends Role {
  source: RoleSource;
  sourcePath: string;
}

/**
 * Result of loading a role file
 */
export interface RoleLoadResult {
  success: boolean;
  role?: LoadedRole;
  error?: string;
  path: string;
}

/**
 * Parsed role file (legacy alias)
 */
export interface ParsedRole {
  role: Role;
  source: string;
  errors: string[];
}

/**
 * Role validation result
 */
export interface RoleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Role validation error
 */
export class RoleValidationError extends Error {
  public readonly filePath: string;
  public readonly field?: string;

  constructor(message: string, filePath: string, field?: string) {
    super(message);
    this.name = 'RoleValidationError';
    this.filePath = filePath;
    this.field = field;
  }
}

/**
 * Role schema version error
 */
export class RoleSchemaVersionError extends Error {
  public readonly filePath: string;
  public readonly suggestion: string;

  constructor(message: string, filePath: string, suggestion: string) {
    super(message);
    this.name = 'RoleSchemaVersionError';
    this.filePath = filePath;
    this.suggestion = suggestion;
  }
}
