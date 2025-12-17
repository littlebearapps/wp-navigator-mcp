/**
 * WP Navigator Role Command
 *
 * CLI commands for managing AI roles:
 * - `wpnav role list` - List available roles
 * - `wpnav role show <slug>` - Show role details
 * - `wpnav role use <slug>` - Set active role for session
 * - `wpnav role clear` - Clear active role
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import {
  success,
  error as errorMessage,
  info,
  newline,
  box,
  keyValue,
  colorize,
  symbols,
} from '../tui/components.js';
import { discoverRoles, getRole, listAvailableRoles, LoadedRole } from '../../roles/index.js';
import { runtimeRoleState, STATE_FILE_NAME } from '../../roles/runtime-state.js';

// =============================================================================
// Types
// =============================================================================

export interface RoleCommandOptions {
  json?: boolean; // Output JSON instead of TUI
}

export interface RoleListResult {
  total: number;
  roles: Array<{
    slug: string;
    name: string;
    description: string;
    source: string;
    focus_areas: string[];
    tools_allowed_count: number;
    tools_denied_count: number;
  }>;
  active?: string | null;
}

export interface RoleShowResult {
  slug: string;
  name: string;
  description: string;
  context: string;
  source: string;
  focus_areas: string[];
  avoid: string[];
  tools: {
    allowed: string[];
    denied: string[];
  };
}

export interface RoleUseResult {
  success: boolean;
  slug: string;
  name: string;
  message: string;
}

// =============================================================================
// Output Helpers
// =============================================================================

function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle `wpnav role list`
 */
export async function handleRoleList(options: RoleCommandOptions = {}): Promise<number> {
  const { roles, sources } = discoverRoles();
  const activeRole = runtimeRoleState.getRole();

  const roleList = Array.from(roles.entries()).map(([slug, role]) => ({
    slug,
    name: role.name,
    description: role.description,
    source: role.source,
    focus_areas: role.focus_areas || [],
    tools_allowed_count: role.tools?.allowed?.length || 0,
    tools_denied_count: role.tools?.denied?.length || 0,
  }));

  if (options.json) {
    outputJSON({
      success: true,
      command: 'role list',
      data: {
        total: roleList.length,
        active: activeRole,
        roles: roleList,
        sources: {
          bundled: sources.bundled.length,
          global: sources.global.length,
          project: sources.project.length,
        },
      },
    });
    return 0;
  }

  // TUI output
  newline();
  box('Available Roles');
  newline();

  if (activeRole) {
    info(`Active role: ${colorize(activeRole, 'cyan')}`);
    newline();
  }

  for (const role of roleList) {
    const isActive = role.slug === activeRole;
    const marker = isActive ? colorize('→ ', 'green') : '  ';
    const name = isActive ? colorize(role.slug, 'green') : role.slug;
    console.error(`${marker}${name}`);
    console.error(`    ${colorize(role.description, 'dim')}`);
    console.error(`    Source: ${role.source}`);
    if (role.tools_allowed_count > 0) {
      console.error(`    Tools allowed: ${role.tools_allowed_count}`);
    }
    if (role.tools_denied_count > 0) {
      console.error(`    Tools denied: ${role.tools_denied_count}`);
    }
    console.error('');
  }

  keyValue('Total', String(roleList.length));
  keyValue('Bundled', String(sources.bundled.length));
  keyValue('Global', String(sources.global.length));
  keyValue('Project', String(sources.project.length));

  return 0;
}

/**
 * Handle `wpnav role show <slug>`
 */
export async function handleRoleShow(
  slug: string,
  options: RoleCommandOptions = {}
): Promise<number> {
  if (!slug) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'role show',
        error: { code: 'MISSING_SLUG', message: 'Role slug required' },
      });
    } else {
      errorMessage('Role slug required. Usage: wpnav role show <slug>');
    }
    return 1;
  }

  const role = getRole(slug);

  if (!role) {
    const available = listAvailableRoles();
    if (options.json) {
      outputJSON({
        success: false,
        command: 'role show',
        error: {
          code: 'ROLE_NOT_FOUND',
          message: `Role not found: ${slug}`,
          available,
        },
      });
    } else {
      errorMessage(`Role not found: ${slug}`);
      newline();
      info('Available roles:');
      for (const r of available) {
        console.error(`  ${r}`);
      }
    }
    return 1;
  }

  if (options.json) {
    outputJSON({
      success: true,
      command: 'role show',
      data: {
        slug: role.name,
        name: role.name,
        description: role.description,
        context: role.context,
        source: role.source,
        focus_areas: role.focus_areas || [],
        avoid: role.avoid || [],
        tools: {
          allowed: role.tools?.allowed || [],
          denied: role.tools?.denied || [],
        },
      },
    });
    return 0;
  }

  // TUI output
  newline();
  box(`Role: ${role.name}`);
  newline();

  keyValue('Name', role.name);
  keyValue('Source', role.source);
  keyValue('Description', role.description);
  newline();

  if (role.context) {
    info('Context (System Prompt):');
    console.error(`  ${colorize(role.context, 'dim')}`);
    newline();
  }

  if (role.focus_areas && role.focus_areas.length > 0) {
    info('Focus Areas:');
    for (const area of role.focus_areas) {
      console.error(`  ${colorize(symbols.success, 'green')} ${area}`);
    }
    newline();
  }

  if (role.avoid && role.avoid.length > 0) {
    info('Avoid:');
    for (const item of role.avoid) {
      console.error(`  ${colorize(symbols.error, 'red')} ${item}`);
    }
    newline();
  }

  if (role.tools?.allowed && role.tools.allowed.length > 0) {
    info(`Tools Allowed (${role.tools.allowed.length}):`);
    for (const tool of role.tools.allowed.slice(0, 10)) {
      console.error(`  ${colorize('+', 'green')} ${tool}`);
    }
    if (role.tools.allowed.length > 10) {
      console.error(`  ... and ${role.tools.allowed.length - 10} more`);
    }
    newline();
  }

  if (role.tools?.denied && role.tools.denied.length > 0) {
    info(`Tools Denied (${role.tools.denied.length}):`);
    for (const tool of role.tools.denied.slice(0, 10)) {
      console.error(`  ${colorize('-', 'red')} ${tool}`);
    }
    if (role.tools.denied.length > 10) {
      console.error(`  ... and ${role.tools.denied.length - 10} more`);
    }
    newline();
  }

  return 0;
}

/**
 * Handle `wpnav role use <slug>`
 */
export async function handleRoleUse(
  slug: string,
  options: RoleCommandOptions = {}
): Promise<number> {
  if (!slug) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'role use',
        error: { code: 'MISSING_SLUG', message: 'Role slug required' },
      });
    } else {
      errorMessage('Role slug required. Usage: wpnav role use <slug>');
    }
    return 1;
  }

  // Initialize runtime state with current directory
  runtimeRoleState.initialize(process.cwd());

  // Set the role
  const result = runtimeRoleState.setRole(slug, 'cli');

  if (!result.success) {
    if (options.json) {
      const available = listAvailableRoles();
      outputJSON({
        success: false,
        command: 'role use',
        error: {
          code: 'ROLE_NOT_FOUND',
          message: result.error || `Role not found: ${slug}`,
          available,
        },
      });
    } else {
      errorMessage(result.error || `Failed to set role: ${slug}`);
      newline();
      info('Available roles:');
      for (const r of listAvailableRoles()) {
        console.error(`  ${r}`);
      }
    }
    return 1;
  }

  const role = getRole(slug)!;

  if (options.json) {
    outputJSON({
      success: true,
      command: 'role use',
      data: {
        slug: role.name,
        name: role.name,
        description: role.description,
        state_file: STATE_FILE_NAME,
        message: 'Role activated for this session',
      },
    });
    return 0;
  }

  // TUI output
  newline();
  success(`Role activated: ${colorize(role.name, 'cyan')}`);
  newline();
  info(role.description);
  newline();
  keyValue('State saved to', STATE_FILE_NAME);
  newline();
  info('The role will apply to MCP tool filtering in new sessions.');
  info('Use "wpnav role clear" to reset to default behavior.');

  return 0;
}

/**
 * Handle `wpnav role clear`
 */
export async function handleRoleClear(options: RoleCommandOptions = {}): Promise<number> {
  // Initialize runtime state with current directory
  runtimeRoleState.initialize(process.cwd());

  const previousRole = runtimeRoleState.getRole();
  runtimeRoleState.clear();

  if (options.json) {
    outputJSON({
      success: true,
      command: 'role clear',
      data: {
        previous_role: previousRole,
        message: 'Active role cleared',
      },
    });
    return 0;
  }

  // TUI output
  newline();
  if (previousRole) {
    success(`Role cleared: ${previousRole}`);
  } else {
    info('No active role to clear.');
  }
  newline();
  info('Tool filtering will now use manifest defaults.');

  return 0;
}

/**
 * Main role command handler
 */
export async function handleRole(
  subcommand: string | undefined,
  args: string[],
  options: RoleCommandOptions = {}
): Promise<number> {
  switch (subcommand) {
    case 'list':
    case undefined:
      return handleRoleList(options);

    case 'show':
      return handleRoleShow(args[0], options);

    case 'use':
      return handleRoleUse(args[0], options);

    case 'clear':
      return handleRoleClear(options);

    default:
      if (options.json) {
        outputJSON({
          success: false,
          command: 'role',
          error: {
            code: 'UNKNOWN_SUBCOMMAND',
            message: `Unknown role subcommand: ${subcommand}`,
            available: ['list', 'show', 'use', 'clear'],
          },
        });
      } else {
        errorMessage(`Unknown role subcommand: ${subcommand}`);
        newline();
        info('Available subcommands:');
        console.error('  list         List available roles');
        console.error('  show <slug>  Show role details');
        console.error('  use <slug>   Set active role for session');
        console.error('  clear        Clear active role');
      }
      return 1;
  }
}

export default handleRole;
