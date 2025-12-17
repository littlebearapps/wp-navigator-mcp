/**
 * Runtime Role State
 *
 * Singleton to track the active role during a session.
 * Supports runtime role switching via wpnav_load_role or CLI.
 *
 * State persistence:
 * - In-memory for current process
 * - .wpnav-state.json for CLI sessions (auto-gitignored)
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoadedRole } from './types.js';
import { getRole } from './loader.js';
import { RuntimeRoleStateData, WpnavStateFile } from './filter-types.js';

/**
 * State file name (auto-gitignored)
 */
export const STATE_FILE_NAME = '.wpnav-state.json';

/**
 * Runtime Role State Singleton
 *
 * Tracks the currently active role during a session.
 */
class RuntimeRoleState {
  private state: RuntimeRoleStateData = {
    activeRole: null,
    source: null,
    setAt: null,
  };

  private projectRoot: string | null = null;

  /**
   * Initialize with project root directory.
   *
   * @param projectRoot - Path to project root (where .wpnav-state.json lives)
   */
  initialize(projectRoot: string): void {
    this.projectRoot = projectRoot;
    this.loadFromFile();
  }

  /**
   * Set the active role.
   *
   * @param roleSlug - Role slug to set, or null to clear
   * @param source - How the role was set
   * @returns Success result
   */
  setRole(
    roleSlug: string | null,
    source: 'cli' | 'tool' | 'state-file'
  ): { success: boolean; error?: string } {
    if (roleSlug !== null) {
      // Validate role exists
      const role = getRole(roleSlug);
      if (!role) {
        return { success: false, error: `Role not found: "${roleSlug}"` };
      }
    }

    this.state = {
      activeRole: roleSlug,
      source: roleSlug ? source : null,
      setAt: roleSlug ? Date.now() : null,
    };

    // Persist to file for CLI sessions
    if (source === 'cli' || source === 'state-file') {
      this.saveToFile();
    }

    return { success: true };
  }

  /**
   * Get the current role slug.
   *
   * @returns Role slug or null if no runtime override
   */
  getRole(): string | null {
    return this.state.activeRole;
  }

  /**
   * Get the loaded role object.
   *
   * @returns LoadedRole or null
   */
  getLoadedRole(): LoadedRole | null {
    if (!this.state.activeRole) {
      return null;
    }
    return getRole(this.state.activeRole);
  }

  /**
   * Get the source of the current role.
   *
   * @returns Source or null if no role
   */
  getSource(): 'cli' | 'tool' | 'state-file' | null {
    return this.state.source;
  }

  /**
   * Get the full state data.
   *
   * @returns Runtime state data
   */
  getState(): RuntimeRoleStateData {
    return { ...this.state };
  }

  /**
   * Clear the runtime role override.
   */
  clear(): void {
    this.state = {
      activeRole: null,
      source: null,
      setAt: null,
    };
    this.deleteFile();
  }

  /**
   * Override the current role.
   * Alias for setRole with validation.
   *
   * @param roleSlug - Role slug to set
   * @param source - How the role was set
   * @returns Result with success status
   */
  overrideRole(
    roleSlug: string,
    source: 'cli' | 'tool' = 'tool'
  ): { success: boolean; error?: string; role?: LoadedRole } {
    const result = this.setRole(roleSlug, source);
    if (result.success) {
      return { success: true, role: this.getLoadedRole() ?? undefined };
    }
    return result;
  }

  /**
   * Load state from .wpnav-state.json file.
   */
  private loadFromFile(): void {
    if (!this.projectRoot) {
      return;
    }

    const filePath = path.join(this.projectRoot, STATE_FILE_NAME);

    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as WpnavStateFile;

      if (data.active_role) {
        // Validate role still exists
        const role = getRole(data.active_role);
        if (role) {
          this.state = {
            activeRole: data.active_role,
            source: 'state-file',
            setAt: data.modified_at ? new Date(data.modified_at).getTime() : Date.now(),
          };
        }
      }
    } catch {
      // Ignore file read errors, start with clean state
    }
  }

  /**
   * Save state to .wpnav-state.json file.
   */
  private saveToFile(): void {
    if (!this.projectRoot) {
      return;
    }

    const filePath = path.join(this.projectRoot, STATE_FILE_NAME);

    try {
      const data: WpnavStateFile = {
        active_role: this.state.activeRole,
        role_source: this.state.source === 'tool' ? undefined : (this.state.source ?? undefined),
        modified_at: new Date().toISOString(),
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    } catch {
      // Ignore file write errors
    }
  }

  /**
   * Delete the state file.
   */
  private deleteFile(): void {
    if (!this.projectRoot) {
      return;
    }

    const filePath = path.join(this.projectRoot, STATE_FILE_NAME);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore file delete errors
    }
  }

  /**
   * Reset state for testing.
   */
  _reset(): void {
    this.state = {
      activeRole: null,
      source: null,
      setAt: null,
    };
    this.projectRoot = null;
  }
}

/**
 * Global runtime role state instance
 */
export const runtimeRoleState = new RuntimeRoleState();
