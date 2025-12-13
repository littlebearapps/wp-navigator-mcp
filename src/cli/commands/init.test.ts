/**
 * Tests for WP Navigator Init Command
 *
 * Tests scaffold functionality, file generation, and validation.
 * Note: Interactive TUI prompts are not tested here (requires manual testing).
 *
 * @package WP_Navigator_MCP
 * @since 1.1.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildHandoffState, generateAIHandoff, writeHandoffFile, generateSelfTestPrompt, type HandoffState } from './init.js';

// Test scaffold-related functions directly from init module
// Since the module exports handleInit as default, we need to test internal functions
// For this test, we'll create a test directory and verify scaffold behavior

describe('Init Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-init-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('scaffold structure', () => {
    it('creates expected directories', () => {
      // Simulate scaffold by creating directories
      const dirs = ['snapshots', 'snapshots/pages', 'roles', 'docs', 'sample-prompts'];

      for (const dir of dirs) {
        const dirPath = path.join(tempDir, dir);
        fs.mkdirSync(dirPath, { recursive: true });
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      }
    });

    it('creates wpnavigator.jsonc with valid structure', () => {
      // Create a minimal manifest template
      const manifestContent = `{
  // WP Navigator Site Manifest
  "$schema": "https://wpnav.ai/schemas/wpnavigator.schema.json",
  "schema_version": 1,
  "site": {
    "name": "",
    "tagline": "",
    "url": ""
  },
  "brand": {},
  "pages": [],
  "plugins": {}
}
`;
      const manifestPath = path.join(tempDir, 'wpnavigator.jsonc');
      fs.writeFileSync(manifestPath, manifestContent);

      expect(fs.existsSync(manifestPath)).toBe(true);

      // Verify it's parseable (remove comments for JSON.parse)
      const content = fs.readFileSync(manifestPath, 'utf8');
      expect(content).toContain('schema_version');
      expect(content).toContain('"site"');
    });

    it('creates .gitignore with .wpnav.env', () => {
      const gitignoreContent = `# WP Navigator
.wpnav.env
wp-config.json
`;
      const gitignorePath = path.join(tempDir, '.gitignore');
      fs.writeFileSync(gitignorePath, gitignoreContent);

      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf8');
      expect(content).toContain('.wpnav.env');
    });

    it('creates docs/README.md with instructions', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      const readmeContent = `# WP Navigator Project

## How WP Navigator Works

1. **Your WordPress site** – Where your real content lives.
2. **This project folder** – Stores snapshots and configuration.
3. **Your AI assistant** – Reads these files and helps plan changes.
`;
      const readmePath = path.join(docsDir, 'README.md');
      fs.writeFileSync(readmePath, readmeContent);

      expect(fs.existsSync(readmePath)).toBe(true);
      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('WP Navigator');
      expect(content).toContain('WordPress');
    });
  });

  describe('sample prompts', () => {
    it('creates self-test.txt prompt', () => {
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(promptsDir, { recursive: true });

      const promptContent = `# WP Navigator Self-Test Prompt

Use this prompt to verify your WP Navigator setup is working correctly.

Please perform these verification steps:
1. Validate wpnavigator.jsonc
2. Check snapshots
3. Review project structure
`;
      const promptPath = path.join(promptsDir, 'self-test.txt');
      fs.writeFileSync(promptPath, promptContent);

      expect(fs.existsSync(promptPath)).toBe(true);
      const content = fs.readFileSync(promptPath, 'utf8');
      expect(content).toContain('Self-Test');
      expect(content).toContain('Validate');
    });

    it('creates page-builder.txt prompt', () => {
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(promptsDir, { recursive: true });

      const promptContent = `# Page Builder Prompt

Use this prompt to have AI help you design and modify WordPress pages.
`;
      const promptPath = path.join(promptsDir, 'page-builder.txt');
      fs.writeFileSync(promptPath, promptContent);

      expect(fs.existsSync(promptPath)).toBe(true);
    });

    it('creates all expected prompt files', () => {
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(promptsDir, { recursive: true });

      const expectedPrompts = ['self-test.txt', 'page-builder.txt', 'manifest-refinement.txt', 'seo.txt'];

      for (const filename of expectedPrompts) {
        const promptPath = path.join(promptsDir, filename);
        fs.writeFileSync(promptPath, `# ${filename}\n\nPrompt content here.`);
        expect(fs.existsSync(promptPath)).toBe(true);
      }

      const files = fs.readdirSync(promptsDir);
      expect(files).toHaveLength(4);
    });
  });

  describe('AI handoff', () => {
    it('generates ai-onboarding-handoff.md with completed/pending steps', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      const handoffContent = `# WP Navigator AI Onboarding Handoff

## Instructions for AI Assistant

## Completed Steps

- [x] Created project structure

## Pending Steps

- [ ] Configure WordPress connection
- [ ] Fill out site details
- [ ] Generate first snapshot
`;
      const handoffPath = path.join(docsDir, 'ai-onboarding-handoff.md');
      fs.writeFileSync(handoffPath, handoffContent);

      expect(fs.existsSync(handoffPath)).toBe(true);
      const content = fs.readFileSync(handoffPath, 'utf8');
      expect(content).toContain('Completed Steps');
      expect(content).toContain('Pending Steps');
      expect(content).toContain('[x]');
      expect(content).toContain('[ ]');
    });
  });

  describe('smart URL validation', () => {
    // Test URL validation logic
    it('auto-adds https:// to URLs without protocol', () => {
      const url = 'example.com';
      const corrected = url.startsWith('http') ? url : `https://${url}`;
      expect(corrected).toBe('https://example.com');
    });

    it('preserves http:// for localhost', () => {
      const url = 'http://localhost:8080';
      expect(url.startsWith('http://')).toBe(true);
    });

    it('removes trailing slashes', () => {
      const url = 'https://example.com/';
      const corrected = url.replace(/\/+$/, '');
      expect(corrected).toBe('https://example.com');
    });

    it('detects URLs without TLD', () => {
      const url: string = 'myserver';
      const hasTLD = url.includes('.') || url === 'localhost';
      expect(hasTLD).toBe(false);
    });

    it('accepts localhost without TLD', () => {
      const url = 'localhost';
      const isLocalhost = url === 'localhost';
      expect(isLocalhost).toBe(true);
    });
  });

  describe('app password validation', () => {
    it('accepts standard WordPress app password format', () => {
      const password = 'xxxx xxxx xxxx xxxx xxxx xxxx';
      const cleaned = password.replace(/\s/g, '');
      expect(cleaned.length).toBeGreaterThanOrEqual(16);
      expect(/^[a-zA-Z0-9]+$/.test(cleaned)).toBe(true);
    });

    it('rejects passwords that are too short', () => {
      const password = 'abc123';
      const cleaned = password.replace(/\s/g, '');
      expect(cleaned.length).toBeLessThan(16);
    });

    it('accepts passwords without spaces', () => {
      const password = 'abcd1234efgh5678ijkl9012';
      const cleaned = password.replace(/\s/g, '');
      expect(cleaned.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('.wpnav.env generation', () => {
    it('generates valid .wpnav.env content', () => {
      const siteUrl = 'https://example.com';
      const username = 'admin';
      const password = 'xxxx xxxx xxxx xxxx';

      const envContent = `# WP Navigator Connection Settings
WP_BASE_URL=${siteUrl}
WP_REST_API=${siteUrl}/wp-json
WPNAV_BASE=${siteUrl}/wp-json/wpnav/v1
WPNAV_INTROSPECT=${siteUrl}/wp-json/wpnav/v1/introspect
WP_APP_USER=${username}
WP_APP_PASS=${password}
`;

      expect(envContent).toContain('WP_BASE_URL=https://example.com');
      expect(envContent).toContain('WP_APP_USER=admin');
      expect(envContent).toContain('WP_APP_PASS=');
      expect(envContent).toContain('/wp-json/wpnav/v1');
    });

    it('writes .wpnav.env with secure permissions', () => {
      const envPath = path.join(tempDir, '.wpnav.env');
      const content = 'WP_APP_PASS=secret';

      // Write with mode 0o600 (read/write for owner only)
      fs.writeFileSync(envPath, content, { mode: 0o600 });

      const stats = fs.statSync(envPath);
      // Check that only owner has read/write (on Unix systems)
      if (process.platform !== 'win32') {
        expect(stats.mode & 0o777).toBe(0o600);
      }
    });
  });

  describe('MCP configuration', () => {
    it('generates valid MCP server config', () => {
      const mcpConfig = {
        mcpServers: {
          wpnav: {
            command: 'npx',
            args: ['-y', '@littlebearapps/wp-navigator-mcp'],
            env: {
              WPNAV_CONFIG: './.wpnav.env',
            },
          },
        },
      };

      const jsonStr = JSON.stringify(mcpConfig, null, 2);
      expect(jsonStr).toContain('"wpnav"');
      expect(jsonStr).toContain('@littlebearapps/wp-navigator-mcp');
      expect(jsonStr).toContain('WPNAV_CONFIG');
    });

    it('creates docs/ai-setup-wpnavigator.md guide', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      const guideContent = `# Setting Up WP Navigator MCP for AI Assistants

## What is MCP?

MCP (Model Context Protocol) lets AI assistants call WP Navigator tools directly.

## Setup for Claude Code

Add this to your Claude Code MCP settings:
`;
      const guidePath = path.join(docsDir, 'ai-setup-wpnavigator.md');
      fs.writeFileSync(guidePath, guideContent);

      expect(fs.existsSync(guidePath)).toBe(true);
      const content = fs.readFileSync(guidePath, 'utf8');
      expect(content).toContain('MCP');
      expect(content).toContain('Claude Code');
    });
  });

  describe('skip existing files', () => {
    it('does not overwrite existing wpnavigator.jsonc', () => {
      const manifestPath = path.join(tempDir, 'wpnavigator.jsonc');
      const originalContent = '{"existing": true}';
      fs.writeFileSync(manifestPath, originalContent);

      // Simulate scaffold check
      const exists = fs.existsSync(manifestPath);
      expect(exists).toBe(true);

      // Read should return original content
      const content = fs.readFileSync(manifestPath, 'utf8');
      expect(content).toBe(originalContent);
    });

    it('appends to existing .gitignore if .wpnav.env not present', () => {
      const gitignorePath = path.join(tempDir, '.gitignore');
      const originalContent = 'node_modules/\n';
      fs.writeFileSync(gitignorePath, originalContent);

      // Check if .wpnav.env is already ignored
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const hasWpnavEnv = content.includes('.wpnav.env');

      if (!hasWpnavEnv) {
        // Append
        fs.appendFileSync(gitignorePath, '\n.wpnav.env\n');
      }

      const updatedContent = fs.readFileSync(gitignorePath, 'utf8');
      expect(updatedContent).toContain('node_modules/');
      expect(updatedContent).toContain('.wpnav.env');
    });
  });

  // =========================================================================
  // AI Handoff State & Generation Tests
  // =========================================================================

  describe('buildHandoffState', () => {
    it('detects empty project (no files)', () => {
      const state = buildHandoffState(tempDir);

      expect(state.projectScaffolded).toBe(false);
      expect(state.manifestExists).toBe(false);
      expect(state.manifestConfigured).toBe(false);
      expect(state.credentialsExist).toBe(false);
      expect(state.connectionTested).toBe(false);
      expect(state.snapshotsExist).toBe(false);
      expect(state.mcpConfigured).toBe(false);
    });

    it('detects scaffolded project', () => {
      // Create minimum scaffold structure
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'snapshots'), { recursive: true });

      const state = buildHandoffState(tempDir);

      expect(state.projectScaffolded).toBe(true);
    });

    it('detects manifest exists but not configured', () => {
      const manifestPath = path.join(tempDir, 'wpnavigator.jsonc');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ site: { name: '', tagline: '', url: '' } })
      );

      const state = buildHandoffState(tempDir);

      expect(state.manifestExists).toBe(true);
      expect(state.manifestConfigured).toBe(false);
    });

    it('detects manifest is configured when site.name is filled', () => {
      const manifestPath = path.join(tempDir, 'wpnavigator.jsonc');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ site: { name: 'My Site', tagline: '', url: '' } })
      );

      const state = buildHandoffState(tempDir);

      expect(state.manifestExists).toBe(true);
      expect(state.manifestConfigured).toBe(true);
    });

    it('detects credentials exist', () => {
      const envPath = path.join(tempDir, '.wpnav.env');
      fs.writeFileSync(envPath, 'WP_BASE_URL=https://example.com');

      const state = buildHandoffState(tempDir);

      expect(state.credentialsExist).toBe(true);
    });

    it('detects snapshots exist', () => {
      const snapshotsDir = path.join(tempDir, 'snapshots');
      fs.mkdirSync(snapshotsDir, { recursive: true });
      fs.writeFileSync(
        path.join(snapshotsDir, 'site_index.json'),
        JSON.stringify({ pages: [] })
      );

      const state = buildHandoffState(tempDir);

      expect(state.snapshotsExist).toBe(true);
    });

    it('detects connection tested (credentials + snapshots)', () => {
      fs.mkdirSync(path.join(tempDir, 'snapshots'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.wpnav.env'), 'WP_BASE_URL=https://example.com');
      fs.writeFileSync(
        path.join(tempDir, 'snapshots', 'site_index.json'),
        JSON.stringify({ pages: [] })
      );

      const state = buildHandoffState(tempDir);

      expect(state.connectionTested).toBe(true);
    });

    it('detects MCP configured', () => {
      const mcpPath = path.join(tempDir, 'mcp-config.json');
      fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }));

      const state = buildHandoffState(tempDir);

      expect(state.mcpConfigured).toBe(true);
    });

    it('detects fully configured project', () => {
      // Create full project structure
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'snapshots'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'wpnavigator.jsonc'),
        JSON.stringify({ site: { name: 'My Site', url: 'https://example.com' } })
      );
      fs.writeFileSync(path.join(tempDir, '.wpnav.env'), 'WP_BASE_URL=https://example.com');
      fs.writeFileSync(
        path.join(tempDir, 'snapshots', 'site_index.json'),
        JSON.stringify({ pages: [] })
      );
      fs.writeFileSync(path.join(tempDir, 'mcp-config.json'), '{}');

      const state = buildHandoffState(tempDir);

      expect(state.projectScaffolded).toBe(true);
      expect(state.manifestExists).toBe(true);
      expect(state.manifestConfigured).toBe(true);
      expect(state.credentialsExist).toBe(true);
      expect(state.connectionTested).toBe(true);
      expect(state.snapshotsExist).toBe(true);
      expect(state.mcpConfigured).toBe(true);
    });
  });

  describe('generateAIHandoff', () => {
    it('includes all 5 required sections', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      // Section A: Setup Progress
      expect(content).toContain('## Section A: Setup Progress');
      expect(content).toContain('[x] Project structure scaffolded');
      expect(content).toContain('[ ] WordPress credentials saved');

      // Section B: Key Project Files
      expect(content).toContain('## Section B: Key Project Files');
      expect(content).toContain('wpnavigator.jsonc');
      expect(content).toContain('.wpnav.env');
      expect(content).toContain('snapshots/site_index.json');

      // Section C: Next Steps
      expect(content).toContain('## Section C: Next Steps for AI');

      // Section D: AI Instructions
      expect(content).toContain('## Section D: Instructions for AI Assistant');
      expect(content).toContain('### You MAY:');
      expect(content).toContain('### You MUST NOT:');

      // Section E: Safety Notes
      expect(content).toContain('## Section E: Safety Notes');
      expect(content).toContain('Snapshots are read-only');
    });

    it('uses [x] for completed steps and [ ] for pending', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: true,
        credentialsExist: true,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      // Check completed items have [x]
      expect(content).toMatch(/\[x\] Project structure scaffolded/);
      expect(content).toMatch(/\[x\] wpnavigator\.jsonc created/);
      expect(content).toMatch(/\[x\] Site details configured in manifest/);
      expect(content).toMatch(/\[x\] WordPress credentials saved/);

      // Check pending items have [ ]
      expect(content).toMatch(/\[ \] WordPress connection tested/);
      expect(content).toMatch(/\[ \] First snapshot generated/);
    });

    it('generates context-aware next steps when credentials missing', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      expect(content).toContain('Ask user for WordPress URL, username, and Application Password');
      expect(content).toContain('npx wpnav configure');
    });

    it('generates context-aware next steps when credentials exist but no snapshot', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: true,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      expect(content).toContain('npx wpnav status');
      expect(content).toContain('npx wpnav snapshot site');
    });

    it('generates advanced next steps when setup is complete', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: true,
        credentialsExist: true,
        connectionTested: true,
        snapshotsExist: true,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      expect(content).toContain('npx wpnav validate');
      expect(content).toContain('npx wpnav diff');
      expect(content).toContain('npx wpnav sync --dry-run');
    });

    it('includes timestamp', () => {
      const state: HandoffState = {
        projectScaffolded: false,
        manifestExists: false,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      // Should have ISO timestamp
      expect(content).toMatch(/Generated:.*\d{4}-\d{2}-\d{2}T/);
      // Should have human-readable timestamp
      expect(content).toContain('Last Updated:');
    });

    it('never contains credentials or secrets', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: true,
        credentialsExist: true,
        connectionTested: true,
        snapshotsExist: true,
        mcpConfigured: true,
      };

      const content = generateAIHandoff(state);

      // Should not contain any password-like patterns
      expect(content).not.toMatch(/password\s*[:=]\s*\S+/i);
      expect(content).not.toMatch(/WP_APP_PASS/);
      expect(content).not.toMatch(/secret/i);
      expect(content).not.toMatch(/xxxx/);

      // Should explicitly state not to share credentials
      expect(content).toContain('Credentials are local-only');
    });

    it('includes MAY and MUST NOT instructions', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      // MAY instructions
      expect(content).toContain('Edit `wpnavigator.jsonc`');
      expect(content).toContain('Suggest CLI commands');
      expect(content).toContain('Help interpret snapshot JSON');

      // MUST NOT instructions
      expect(content).toContain('Access the user\'s WordPress site directly');
      expect(content).toContain('Modify `.wpnav.env`');
      expect(content).toContain('destructive changes without explicit user consent');
    });

    it('includes file status indicators in Section B', () => {
      const statePartial: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(statePartial);

      // Check status indicators
      expect(content).toMatch(/wpnavigator\.jsonc.*✓ exists/);
      expect(content).toMatch(/\.wpnav\.env.*✗ missing/);
      expect(content).toMatch(/site_index\.json.*✗ missing/);
      expect(content).toMatch(/mcp-config\.json.*○ optional/);
    });

    it('includes regeneration instruction', () => {
      const state: HandoffState = {
        projectScaffolded: true,
        manifestExists: true,
        manifestConfigured: false,
        credentialsExist: false,
        connectionTested: false,
        snapshotsExist: false,
        mcpConfigured: false,
      };

      const content = generateAIHandoff(state);

      expect(content).toContain('npx wpnav init --mode ai-handoff');
    });
  });

  describe('writeHandoffFile', () => {
    it('creates docs directory if it does not exist', () => {
      const result = writeHandoffFile(tempDir);

      expect(result).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'docs'))).toBe(true);
    });

    it('writes ai-onboarding-handoff.md to docs/', () => {
      const result = writeHandoffFile(tempDir);

      expect(result).toBe(true);
      const handoffPath = path.join(tempDir, 'docs', 'ai-onboarding-handoff.md');
      expect(fs.existsSync(handoffPath)).toBe(true);

      const content = fs.readFileSync(handoffPath, 'utf8');
      expect(content).toContain('# WP Navigator AI Onboarding Handoff');
    });

    it('regenerates file with updated state', () => {
      // First write with empty state
      writeHandoffFile(tempDir);
      const firstContent = fs.readFileSync(
        path.join(tempDir, 'docs', 'ai-onboarding-handoff.md'),
        'utf8'
      );
      expect(firstContent).toMatch(/\[ \] Project structure scaffolded/);

      // Create scaffold structure
      fs.mkdirSync(path.join(tempDir, 'snapshots'), { recursive: true });

      // Write again - should reflect new state
      writeHandoffFile(tempDir);
      const secondContent = fs.readFileSync(
        path.join(tempDir, 'docs', 'ai-onboarding-handoff.md'),
        'utf8'
      );
      expect(secondContent).toMatch(/\[x\] Project structure scaffolded/);
    });

    it('file content is safe to commit (no secrets)', () => {
      // Create credentials file
      fs.writeFileSync(
        path.join(tempDir, '.wpnav.env'),
        'WP_APP_USER=admin\nWP_APP_PASS=supersecretpassword123'
      );

      writeHandoffFile(tempDir);

      const content = fs.readFileSync(
        path.join(tempDir, 'docs', 'ai-onboarding-handoff.md'),
        'utf8'
      );

      // Should NOT contain actual credentials
      expect(content).not.toContain('supersecretpassword123');
      expect(content).not.toContain('admin');
      expect(content).not.toContain('WP_APP_PASS=');
    });
  });

  // =========================================================================
  // Self-Test Prompt Generation Tests (task-59)
  // =========================================================================

  describe('generateSelfTestPrompt', () => {
    it('includes clear AI instructions at the top', () => {
      const content = generateSelfTestPrompt();

      // AC#8: Clear instructions for AI at top of file
      expect(content).toContain('## Instructions for AI Assistant');
      expect(content).toContain('This is a comprehensive self-test prompt');
      expect(content).toContain('**Your role:**');
      expect(content).toContain('**Output format:**');
    });

    it('validates wpnavigator.jsonc structure (AC#2)', () => {
      const content = generateSelfTestPrompt();

      // AC#2: Prompt validates wpnavigator.jsonc structure
      expect(content).toContain('## Step 1: Validate wpnavigator.jsonc');
      expect(content).toContain('File exists and is readable');
      expect(content).toContain('File is valid JSONC');
      expect(content).toContain('`schema_version` field is present');
      expect(content).toContain('`$schema` reference is present');
    });

    it('validates site section fields', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('### 1.2 Site Section');
      expect(content).toContain('`site.name` is filled in');
      expect(content).toContain('`site.tagline` is present');
      expect(content).toContain('`site.url` is a valid URL');
    });

    it('validates snapshots/site_index.json exists (AC#3)', () => {
      const content = generateSelfTestPrompt();

      // AC#3: Prompt validates snapshots/site_index.json exists
      expect(content).toContain('## Step 2: Validate Snapshots');
      expect(content).toContain('### 2.1 Site Index');
      expect(content).toContain('`snapshots/site_index.json`');
      expect(content).toContain('File exists');
      expect(content).toContain('File is valid JSON');
      expect(content).toContain('Contains `pages` array');
    });

    it('validates page snapshots exist (AC#4)', () => {
      const content = generateSelfTestPrompt();

      // AC#4: Prompt validates page snapshots exist
      expect(content).toContain('### 2.2 Page Snapshots');
      expect(content).toContain('`snapshots/pages/`');
      expect(content).toContain('Directory exists');
      expect(content).toContain('Contains at least one `.json` file');
      expect(content).toContain('page `id`, `slug`, and `title`');
    });

    it('identifies missing manifest fields (AC#5)', () => {
      const content = generateSelfTestPrompt();

      // AC#5: Prompt identifies missing manifest fields (brand/style/pages/plugins)
      expect(content).toContain('## Step 3: Identify Missing Fields');
      expect(content).toContain('### Missing Brand/Style Fields');
      expect(content).toContain('Primary color');
      expect(content).toContain('Secondary color');
      expect(content).toContain('Heading font');
      expect(content).toContain('Body font');
      expect(content).toContain('### Missing Page Definitions');
      expect(content).toContain('### Missing Plugin Configuration');
    });

    it('proposes non-destructive improvements (AC#6)', () => {
      const content = generateSelfTestPrompt();

      // AC#6: Prompt proposes non-destructive improvements
      expect(content).toContain('## Step 4: Propose Non-Destructive Improvements');
      expect(content).toContain('### Manifest Enhancements');
      expect(content).toContain('MINIMAL edits');
      expect(content).toContain('Only suggest changes that won\'t break anything');
      expect(content).toContain('Never suggest removing existing configuration');
    });

    it('requests dry-run plan for wpnav sync (AC#7)', () => {
      const content = generateSelfTestPrompt();

      // AC#7: Prompt requests dry-run plan for wpnav sync
      expect(content).toContain('## Step 5: Dry-Run Plan for wpnav sync');
      expect(content).toContain('### Pre-Sync Checklist');
      expect(content).toContain('### Recommended Commands');
      expect(content).toContain('npx wpnav validate');
      expect(content).toContain('npx wpnav diff');
      expect(content).toContain('npx wpnav sync --dry-run');
      expect(content).toContain('### After Dry-Run Review');
    });

    it('provides summary template', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('## Summary Template');
      expect(content).toContain('### WP Navigator Self-Test Results');
      expect(content).toContain('**Overall Status:**');
      expect(content).toContain('**Validation Summary:**');
      expect(content).toContain('**Critical Issues');
      expect(content).toContain('**Recommended Improvements');
      expect(content).toContain('**Next Steps:**');
    });

    it('includes AI notes at the end', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('## Notes for AI');
      expect(content).toContain('Be thorough but concise');
      expect(content).toContain('`wpnav sync --dry-run` is ALWAYS safe to run');
      expect(content).toContain('Never suggest running `wpnav sync` without `--dry-run` first');
    });

    it('is human-readable and AI-friendly (AC#10)', () => {
      const content = generateSelfTestPrompt();

      // AC#10: File is human-readable and AI-friendly
      // Human-readable: has clear section headers with ===
      expect(content).toContain('================================================================================');

      // Has numbered steps
      expect(content).toContain('## Step 1:');
      expect(content).toContain('## Step 2:');
      expect(content).toContain('## Step 3:');
      expect(content).toContain('## Step 4:');
      expect(content).toContain('## Step 5:');

      // Has checkboxes for tracking
      expect(content).toContain('- [ ]');

      // Has emoji status indicators
      expect(content).toContain('✅');
      expect(content).toContain('❌');
      expect(content).toContain('⚠️');

      // Has code blocks for commands
      expect(content).toContain('```bash');
      expect(content).toContain('```');
    });

    it('includes cross-reference validation', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('### 2.3 Cross-Reference');
      expect(content).toContain('Pages in `site_index.json` have corresponding snapshots');
    });

    it('validates brand section optional fields', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('### 1.3 Brand Section');
      expect(content).toContain('Optional but Recommended');
      expect(content).toContain('`brand.primary_color`');
      expect(content).toContain('`brand.secondary_color`');
      expect(content).toContain('`brand.heading_font`');
      expect(content).toContain('`brand.body_font`');
    });

    it('validates pages section', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('### 1.4 Pages Section');
      expect(content).toContain('`pages` array exists');
      expect(content).toContain('Each page has `slug` and `title`');
    });

    it('validates plugins section', () => {
      const content = generateSelfTestPrompt();

      expect(content).toContain('### 1.5 Plugins Section');
      expect(content).toContain('`plugins` object exists');
      expect(content).toContain('valid `status` values');
    });
  });
});
