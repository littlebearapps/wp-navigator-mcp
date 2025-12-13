/**
 * WP Navigator Roles Loader
 *
 * Loads role files from the roles/ directory.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Role, ParsedRole } from './types.js';

/**
 * Load a role from file
 */
export async function loadRole(filePath: string): Promise<ParsedRole> {
  const content = fs.readFileSync(filePath, 'utf8');
  // Placeholder - actual implementation in Phase B3
  const roleName = path.basename(filePath, path.extname(filePath));
  return {
    role: {
      name: roleName,
      description: '',
      context: '',
    },
    source: filePath,
    errors: [],
  };
}

/**
 * Load all roles from a directory
 */
export async function loadRoles(directory: string): Promise<ParsedRole[]> {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = fs.readdirSync(directory).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const roles: ParsedRole[] = [];

  for (const file of files) {
    const role = await loadRole(path.join(directory, file));
    roles.push(role);
  }

  return roles;
}
