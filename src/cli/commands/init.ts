/**
 * WP Navigator Init Command
 *
 * Enhanced onboarding wizard with TUI experience.
 * Supports three modes:
 * - Guided onboarding (5-step wizard)
 * - Scaffold only (quick setup for developers)
 * - AI handoff (generate instructions for AI to complete)
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  inputPrompt,
  selectPrompt,
  confirmPrompt,
  pressEnterToContinue,
} from '../tui/prompts.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  box,
  keyValue,
  createSpinner,
  colorize,
  list,
  stepHeader,
  progressBar,
  divider,
  symbols,
  colors,
  supportsColor,
  modeIndicator,
} from '../tui/components.js';
import {
  printResourceLinks,
  demoLink,
  helpLink,
  docsLink,
  WPNAV_URLS,
} from '../tui/links.js';
import {
  detectPlugin,
  checkMcpCompatibility,
  formatPluginMessage,
  getEditionFeatures,
  type PluginEdition,
  type PluginDetectionResult,
} from '../../plugin-detection.js';
import {
  generateClaudeMd,
  generateMcpJson,
  getDefaultClaudeMdContext,
} from '../init/generators.js';
import {
  runSmokeTest,
  displaySmokeTestResult,
} from '../init/smoke-test.js';
import {
  detectEnvironment,
  getExpressDefaults,
  formatAppliedDefaults,
  describeDefaults,
  isLocalUrl,
} from '../init/defaults.js';
import {
  displayGraduationPrompt,
} from '../init/graduation.js';
import {
  generateGitignore,
  checkTrackedSensitiveFiles,
  generateGitignoreAppend,
} from '../init/gitignore.js';

// =============================================================================
// Types
// =============================================================================

export type InitMode = 'guided' | 'scaffold' | 'ai-handoff';

export interface InitOptions {
  mode?: InitMode;
  skipConfirm?: boolean;
  skipSmokeTest?: boolean;
  silent?: boolean;
  siteUrl?: string;
  username?: string;
  password?: string;
  json?: boolean;
  express?: boolean;
}

export interface InitResult {
  success: boolean;
  mode: InitMode;
  files_created: string[];
  files_skipped: string[];
  errors: string[];
  connection?: {
    site_url: string;
    site_name?: string;
    plugin_edition?: string;
    plugin_version?: string;
  };
}

interface ScaffoldResult {
  created: string[];
  skipped: string[];
  errors: string[];
}

interface ConnectionTestResult {
  success: boolean;
  siteName?: string;
  pluginVersion?: string;
  pluginEdition?: PluginEdition;
  mcpCompatWarning?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TOTAL_GUIDED_STEPS = 5;

// Project structure directories
const PROJECT_DIRS = ['snapshots', 'snapshots/pages', 'roles', 'docs', 'sample-prompts'];

// =============================================================================
// Branded Header
// =============================================================================

/**
 * Display branded WP Navigator header
 */
function displayHeader(): void {
  const border = supportsColor() ? colorize('═'.repeat(40), 'cyan') : '='.repeat(40);
  const title = supportsColor() ? colorize('WP Navigator', 'bold') : 'WP Navigator';

  console.error('');
  console.error(border);
  console.error(`     ${title} – Project Setup`);
  console.error(border);
  console.error('');
}

/**
 * Display step with progress
 */
function displayStep(current: number, total: number, title: string): void {
  newline();
  console.error(stepHeader({ current, total, title }));
  console.error(progressBar({ percent: (current / total) * 100, width: 30 }));
  newline();
}

// =============================================================================
// Project Structure Templates
// =============================================================================

/**
 * Generate minimal wpnavigator.jsonc template
 */
function generateManifestTemplate(): string {
  return `{
  // WP Navigator Site Manifest
  // This file defines what you WANT your site to look like.
  // AI assistants read this file to understand your intent.
  //
  // Schema version: 1
  "$schema": "https://wpnav.ai/schemas/wpnavigator.schema.json",
  "schema_version": 1,

  // Site identity
  "site": {
    "name": "",
    "tagline": "",
    "url": ""
  },

  // Brand guidelines (optional - for Full Setup)
  "brand": {
    // "primary_color": "#0073aa",
    // "secondary_color": "#23282d",
    // "heading_font": "System UI",
    // "body_font": "System UI"
  },

  // Pages to manage
  "pages": [
    // Example:
    // {
    //   "slug": "home",
    //   "title": "Home",
    //   "template": "front-page"
    // }
  ],

  // Plugins configuration
  "plugins": {
    // "woocommerce": { "status": "active" }
  }
}
`;
}

/**
 * Generate docs/README.md content
 */
function generateDocsReadme(): string {
  return `# WP Navigator Project

This folder contains your WP Navigator project files.

## How WP Navigator Works

1. **Your WordPress site** – Where your real content and pages live.

2. **This project folder** – Stores:
   - \`snapshots/\` – What your site looks like now (read from WordPress)
   - \`wpnavigator.jsonc\` – What you WANT your site to look like (your intent)

3. **Your AI assistant** (Claude, Codex, etc.) – Reads these files, helps you plan changes, and WP Navigator applies them safely.

The AI never talks directly to your live site – it only edits files in this folder.
You stay in control.

## Quick Start

1. Open this folder in Claude Code or Codex Cloud
2. Show it:
   - \`wpnavigator.jsonc\`
   - \`snapshots/site_index.json\`
   - \`snapshots/pages/home.json\`
3. Ask: "Help me review my WP Navigator setup"
4. When ready, run: \`npx wpnav sync\`

## Commands

\`\`\`bash
npx wpnav status          # Check WordPress connection
npx wpnav snapshot site   # Update site snapshot
npx wpnav diff            # Compare manifest vs WordPress
npx wpnav sync --dry-run  # Preview changes before applying
npx wpnav sync            # Apply changes to WordPress
\`\`\`

## Links

- Demo: https://wpnav.ai/start/demo
- Help: https://wpnav.ai/help
- Docs: https://wpnav.ai/docs
`;
}

/**
 * Generate comprehensive self-test prompt for AI validation
 *
 * This prompt helps users verify their WP Navigator setup is working correctly.
 * It guides the AI through validating:
 * - wpnavigator.jsonc structure and completeness
 * - snapshots folder contents (site_index.json and page snapshots)
 * - Missing manifest fields (brand/style/pages/plugins)
 * - Non-destructive improvement suggestions
 * - Dry-run plan for wpnav sync
 */
export function generateSelfTestPrompt(): string {
  return `# WP Navigator Self-Test Prompt
================================================================================

## Instructions for AI Assistant

This is a comprehensive self-test prompt for validating a WP Navigator setup.
Read these instructions carefully, then perform ALL validation steps below.

**Your role:** You are validating the user's WP Navigator project configuration.
You should be thorough, check each item systematically, and provide clear feedback.

**Output format:** Use checkboxes to show pass/fail status for each check:
- ✅ = Passed
- ❌ = Failed (explain why and how to fix)
- ⚠️ = Warning (optional item missing or could be improved)

================================================================================

## Step 1: Validate wpnavigator.jsonc

Read the \`wpnavigator.jsonc\` file and verify:

### 1.1 File Structure
- [ ] File exists and is readable
- [ ] File is valid JSONC (JSON with comments allowed)
- [ ] \`schema_version\` field is present and equals \`1\`
- [ ] \`$schema\` reference is present

### 1.2 Site Section (Required)
Check the \`site\` object:
- [ ] \`site.name\` is filled in (not empty string)
- [ ] \`site.tagline\` is present (can be empty)
- [ ] \`site.url\` is a valid URL (if filled in)

### 1.3 Brand Section (Optional but Recommended)
Check the \`brand\` object for these optional fields:
- [ ] \`brand.primary_color\` - valid hex color (e.g., #0073aa)
- [ ] \`brand.secondary_color\` - valid hex color
- [ ] \`brand.heading_font\` - font family name
- [ ] \`brand.body_font\` - font family name

### 1.4 Pages Section
Check the \`pages\` array:
- [ ] \`pages\` array exists
- [ ] At least one page is defined (if site has been snapshotted)
- [ ] Each page has \`slug\` and \`title\` properties

### 1.5 Plugins Section
Check the \`plugins\` object:
- [ ] \`plugins\` object exists
- [ ] Plugin entries have valid \`status\` values (active/inactive)

================================================================================

## Step 2: Validate Snapshots

### 2.1 Site Index
Check \`snapshots/site_index.json\`:
- [ ] File exists
- [ ] File is valid JSON
- [ ] Contains \`pages\` array with page metadata
- [ ] Contains \`timestamp\` or creation date

### 2.2 Page Snapshots
Check \`snapshots/pages/\` directory:
- [ ] Directory exists
- [ ] Contains at least one \`.json\` file (if site has pages)
- [ ] Each snapshot file:
  - [ ] Is valid JSON
  - [ ] Contains page \`id\`, \`slug\`, and \`title\`
  - [ ] Contains \`content\` or \`blocks\` data
  - [ ] Has reasonable file size (not corrupted)

### 2.3 Cross-Reference
- [ ] Pages in \`site_index.json\` have corresponding snapshots
- [ ] Pages in \`wpnavigator.jsonc\` match snapshotted pages (if applicable)

================================================================================

## Step 3: Identify Missing Fields

Report which optional fields could improve the configuration:

### Missing Brand/Style Fields
List any empty or commented-out brand fields that could be configured:
- Primary color
- Secondary color
- Heading font
- Body font

### Missing Page Definitions
Compare \`site_index.json\` pages against \`wpnavigator.jsonc\` pages:
- List pages that exist on the site but aren't in the manifest
- Suggest which pages are important to add (home, about, contact, etc.)

### Missing Plugin Configuration
If plugins are detected in snapshots but not in manifest:
- List active plugins that could be added to \`plugins\` section
- Note any plugins that might need configuration

================================================================================

## Step 4: Propose Non-Destructive Improvements

Based on your validation, suggest safe improvements:

### Manifest Enhancements
Propose MINIMAL edits to \`wpnavigator.jsonc\`:
- Fill in empty \`site.name\` if detected in snapshots
- Add commented-out brand color suggestions
- Add missing page entries (commented out as examples)

**Important:**
- Only suggest changes that won't break anything
- Prefer adding comments/examples over making active changes
- Never suggest removing existing configuration

### File Organization
- Suggest creating missing directories if needed
- Recommend taking new snapshots if data is stale

================================================================================

## Step 5: Dry-Run Plan for wpnav sync

If the setup passes basic validation, outline a safe testing workflow:

### Pre-Sync Checklist
1. [ ] All validation steps above pass (or only have warnings)
2. [ ] User has recent backup of WordPress site
3. [ ] User understands what changes will be made

### Recommended Commands
\`\`\`bash
# First, validate the configuration
npx wpnav validate

# Compare manifest intent vs current WordPress state
npx wpnav diff

# Preview what sync would change (SAFE - no changes made)
npx wpnav sync --dry-run

# Review the dry-run output carefully before proceeding
\`\`\`

### After Dry-Run Review
Explain what the dry-run output means:
- Which pages would be created/updated
- Which plugin states would change
- Any potential conflicts or warnings

================================================================================

## Summary Template

After completing all steps, provide a summary using this format:

### WP Navigator Self-Test Results

**Overall Status:** [✅ PASS / ⚠️ PARTIAL / ❌ NEEDS ATTENTION]

**Validation Summary:**
| Category | Status | Issues |
|----------|--------|--------|
| wpnavigator.jsonc | ✅/⚠️/❌ | ... |
| snapshots/site_index.json | ✅/⚠️/❌ | ... |
| Page snapshots | ✅/⚠️/❌ | ... |
| Missing fields | ✅/⚠️/❌ | ... |

**Critical Issues (must fix):**
- (list any blocking issues)

**Recommended Improvements:**
- (list non-critical suggestions)

**Next Steps:**
1. (prioritized action items)

================================================================================

## Notes for AI

- Be thorough but concise in your output
- If a file doesn't exist, say so clearly and explain how to create it
- If you can't read a file, ask the user to share its contents
- Focus on actionable feedback - what can the user do to improve?
- Remember: \`wpnav sync --dry-run\` is ALWAYS safe to run
- Never suggest running \`wpnav sync\` without \`--dry-run\` first
`;
}

/**
 * Generate sample prompt files
 *
 * These prompts are created during `wpnav init` and provide ready-to-use
 * AI interaction patterns. Each prompt:
 * - Has clear instructions at the top
 * - References wpnavigator.jsonc for context
 * - Follows non-destructive patterns
 * - Is reusable across AI sessions
 */
function generateSamplePrompts(): Record<string, string> {
  return {
    'self-test.txt': generateSelfTestPrompt(),

    'add-page.txt': `# Add Page Workflow
================================================================================

## Instructions for AI Assistant

This prompt helps you add a new page to a WordPress site using WP Navigator.
Follow these steps carefully to ensure a safe, non-destructive workflow.

**Your role:** Guide the user through planning and creating a new page.
**Safety first:** Always use \`--dry-run\` before applying any changes.

================================================================================

## Context Files to Read

Before proceeding, read these files:

1. \`wpnavigator.jsonc\` - Site configuration and existing pages
2. \`snapshots/site_index.json\` - Current site structure
3. Any existing page snapshots in \`snapshots/pages/\` for reference

================================================================================

## Step 1: Gather Requirements

Ask the user about the new page:

- **Page title**: What should the page be called?
- **Page slug**: What URL path? (e.g., "about-us" → /about-us/)
- **Purpose**: What is this page for?
- **Content structure**: Hero? Features? CTA? Contact form?
- **Template**: Should it use a specific page template?

================================================================================

## Step 2: Check for Conflicts

Review wpnavigator.jsonc and snapshots to ensure:

- [ ] The slug doesn't already exist
- [ ] The page fits the site's navigation structure
- [ ] The content matches the site's brand/tone

================================================================================

## Step 3: Plan the Page Structure

Based on the user's requirements, propose a page structure:

\`\`\`json
{
  "slug": "example-page",
  "title": "Example Page",
  "template": "default",
  "content": {
    "blocks": [
      // Propose block structure here
    ]
  }
}
\`\`\`

Explain each section and get user approval.

================================================================================

## Step 4: Update the Manifest

Add the new page to the \`pages\` array in wpnavigator.jsonc:

\`\`\`json
{
  "pages": [
    // ... existing pages ...
    {
      "slug": "new-page-slug",
      "title": "New Page Title",
      "template": "default"
    }
  ]
}
\`\`\`

================================================================================

## Step 5: Preview and Apply

Guide the user through the safe sync workflow:

\`\`\`bash
# 1. Validate the updated manifest
npx wpnav validate

# 2. See what would change
npx wpnav diff

# 3. Preview the sync (SAFE - no changes made)
npx wpnav sync --dry-run

# 4. If dry-run looks good, apply changes
npx wpnav sync
\`\`\`

================================================================================

## Safety Notes

- **Never skip --dry-run**: Always preview before applying
- **One page at a time**: Don't add multiple pages in one sync
- **Backup reminder**: Suggest the user has a recent backup
- **Reversible**: WP Navigator creates pre-sync snapshots for rollback

================================================================================
`,

    'update-plugin.txt': `# Plugin Update Workflow
================================================================================

## Instructions for AI Assistant

This prompt helps you manage WordPress plugins using WP Navigator.
Follow these steps for safe, non-destructive plugin management.

**Your role:** Help the user review and update plugin configurations.
**Safety first:** Always preview changes before applying.

================================================================================

## Context Files to Read

1. \`wpnavigator.jsonc\` - Current plugin configuration
2. \`snapshots/site_index.json\` - Actual plugin states on WordPress

================================================================================

## Step 1: Review Current State

List all plugins from the snapshot:

| Plugin | Configured State | Actual State | Status |
|--------|------------------|--------------|--------|
| ... | ... | ... | ✓ / ⚠️ |

Identify:
- Plugins in manifest but not on site
- Plugins on site but not in manifest
- State mismatches (manifest says "active" but site has "inactive")

================================================================================

## Step 2: Gather User Intent

Ask the user:

- Which plugins should be **activated**?
- Which plugins should be **deactivated**?
- Any plugins that should be **ignored** (not managed by WP Navigator)?

================================================================================

## Step 3: Update the Manifest

Update the \`plugins\` section in wpnavigator.jsonc:

\`\`\`json
{
  "plugins": {
    "plugin-slug": { "status": "active" },
    "another-plugin": { "status": "inactive" }
  }
}
\`\`\`

**Guidelines:**
- Use the exact plugin slug (folder name)
- Valid statuses: \`"active"\` or \`"inactive"\`
- Omit plugins you don't want to manage

================================================================================

## Step 4: Preview and Apply

\`\`\`bash
# 1. Validate the updated manifest
npx wpnav validate

# 2. See what would change
npx wpnav diff

# 3. Preview the sync (SAFE - no changes made)
npx wpnav sync --dry-run

# 4. If dry-run looks good, apply changes
npx wpnav sync
\`\`\`

================================================================================

## Safety Notes

- **Test on staging first**: Plugin changes can break sites
- **One plugin at a time**: For critical plugins, change one and verify
- **Check dependencies**: Some plugins depend on others
- **Backup first**: Always have a recent backup before plugin changes
- **WP Navigator does not install/uninstall**: It only activates/deactivates

================================================================================

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin not found | Check the slug matches exactly |
| Activation failed | Plugin may have unmet dependencies |
| Site broken after sync | Run \`npx wpnav rollback\` to restore |

================================================================================
`,

    'content-audit.txt': `# Content Audit Prompt
================================================================================

## Instructions for AI Assistant

This prompt helps you perform a comprehensive content audit of a WordPress site.
The goal is to identify issues, gaps, and improvement opportunities.

**Your role:** Analyze site content and provide actionable recommendations.
**Output:** A structured audit report with prioritized findings.

================================================================================

## Context Files to Read

1. \`wpnavigator.jsonc\` - Site configuration and intent
2. \`snapshots/site_index.json\` - Full site structure
3. \`snapshots/pages/*.json\` - Individual page content

================================================================================

## Audit Categories

### 1. Content Inventory

Create a table of all pages:

| Page | Title | Word Count | Last Updated | Status |
|------|-------|------------|--------------|--------|
| /home | Home | ~500 | 2024-01-15 | ✓ |
| /about | About Us | ~200 | 2023-06-01 | ⚠️ Stale |

Identify:
- [ ] Pages with very little content (<100 words)
- [ ] Pages not updated in >6 months
- [ ] Orphaned pages (no internal links to them)
- [ ] Missing critical pages (Contact, About, Privacy Policy)

### 2. Content Quality

For each major page, check:
- [ ] Clear headline/H1
- [ ] Compelling introduction
- [ ] Logical content structure (headings hierarchy)
- [ ] Call-to-action (CTA) where appropriate
- [ ] Mobile-friendly formatting

### 3. SEO Basics

Check each page for:
- [ ] Page title (<60 characters, descriptive)
- [ ] Meta description (<160 characters)
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] Image alt text
- [ ] Internal links to related content

### 4. Brand Consistency

Compare content against \`wpnavigator.jsonc\` brand settings:
- [ ] Colors match brand palette?
- [ ] Tone matches brand voice?
- [ ] Consistent terminology throughout?

### 5. Technical Issues

Look for:
- [ ] Broken internal links
- [ ] Missing images
- [ ] Outdated information (dates, prices, etc.)
- [ ] Duplicate content across pages

================================================================================

## Output Format

Provide findings as a prioritized list:

### Critical Issues (Fix Immediately)
- Issue 1: [description] → [recommendation]

### High Priority (Fix Soon)
- Issue 2: [description] → [recommendation]

### Medium Priority (Plan to Address)
- Issue 3: [description] → [recommendation]

### Low Priority (Nice to Have)
- Issue 4: [description] → [recommendation]

================================================================================

## Non-Destructive Approach

This audit is **read-only**. To implement recommendations:

1. Discuss findings with the user
2. Update \`wpnavigator.jsonc\` with approved changes
3. Run \`npx wpnav sync --dry-run\` to preview
4. Apply changes only after user approval

================================================================================
`,

    'style-guide.txt': `# Style Guide Generator
================================================================================

## Instructions for AI Assistant

This prompt helps you extract and document a style guide from an existing
WordPress site. The goal is to capture the site's visual and content patterns.

**Your role:** Analyze the site and generate a comprehensive style guide.
**Output:** A document that can be used to maintain consistency.

================================================================================

## Context Files to Read

1. \`wpnavigator.jsonc\` - Existing brand configuration
2. \`snapshots/site_index.json\` - Site structure
3. \`snapshots/pages/*.json\` - Page content with styling

================================================================================

## Step 1: Extract Visual Patterns

### Colors

Analyze page content and manifest for:
- **Primary color**: Main brand color (buttons, links, accents)
- **Secondary color**: Supporting brand color
- **Background colors**: Page backgrounds, section backgrounds
- **Text colors**: Headings, body text, muted text

Output format:
\`\`\`
Primary:    #0073aa (bright blue)
Secondary:  #23282d (dark gray)
Background: #ffffff (white)
Text:       #1e1e1e (near-black)
Muted:      #757575 (gray)
\`\`\`

### Typography

Identify from content:
- **Heading font**: What font family for H1-H6?
- **Body font**: What font for paragraphs?
- **Font sizes**: Typical sizes for each heading level
- **Line height**: Spacing between lines

### Spacing

Look for patterns in:
- Section padding (vertical spacing between sections)
- Container width (max content width)
- Element margins (space between elements)

================================================================================

## Step 2: Extract Content Patterns

### Voice & Tone

Analyze existing content for:
- **Formality**: Casual, professional, technical?
- **Person**: First person (we), second person (you)?
- **Sentence length**: Short and punchy, or detailed?
- **Terminology**: Industry-specific terms used consistently?

### Content Structure

Document common patterns:
- How do pages typically start? (Hero? Headline?)
- What sections appear frequently? (Features, testimonials, CTA)
- How are CTAs formatted? (Button text, placement)

================================================================================

## Step 3: Generate Style Guide

Create a style guide document with these sections:

### Brand Identity
- Site name, tagline
- Brand values/personality

### Color Palette
- Primary, secondary, accent colors
- Usage guidelines for each

### Typography
- Font families
- Size scale
- Weight usage

### Components
- Button styles
- Card patterns
- Form elements

### Content Guidelines
- Voice and tone
- Writing style
- Common phrases

================================================================================

## Step 4: Update Manifest

Suggest updates to the \`brand\` section of wpnavigator.jsonc:

\`\`\`json
{
  "brand": {
    "primary_color": "#0073aa",
    "secondary_color": "#23282d",
    "heading_font": "System UI",
    "body_font": "System UI",
    "voice": "Professional but approachable"
  }
}
\`\`\`

================================================================================

## Non-Destructive Approach

This is a **documentation exercise**. The style guide helps:
- Maintain consistency in future content
- Onboard new team members
- Guide AI assistants in content creation

To save the style guide:
1. Create \`docs/style-guide.md\` with the generated content
2. Update \`wpnavigator.jsonc\` brand section with extracted values
3. Use \`npx wpnav sync --dry-run\` if making manifest changes

================================================================================
`,
  };
}

// =============================================================================
// AI Handoff State & Generation
// =============================================================================

/**
 * State of the onboarding process for AI handoff
 */
export interface HandoffState {
  projectScaffolded: boolean;
  manifestExists: boolean;
  manifestConfigured: boolean;
  credentialsExist: boolean;
  connectionTested: boolean;
  snapshotsExist: boolean;
  mcpConfigured: boolean;
}

/**
 * Build handoff state by inspecting filesystem
 */
export function buildHandoffState(cwd: string): HandoffState {
  const manifestPath = path.join(cwd, 'wpnavigator.jsonc');
  const envPath = path.join(cwd, '.wpnav.env');
  const snapshotsDir = path.join(cwd, 'snapshots');
  const siteIndexPath = path.join(cwd, 'snapshots', 'site_index.json');
  const mcpConfigPath = path.join(cwd, 'mcp-config.json');
  const docsDir = path.join(cwd, 'docs');

  // Check if project is scaffolded (at minimum, has docs/ and snapshots/)
  const projectScaffolded = fs.existsSync(docsDir) && fs.existsSync(snapshotsDir);

  // Check manifest
  const manifestExists = fs.existsSync(manifestPath);
  let manifestConfigured = false;
  if (manifestExists) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      // Check if site.name has been filled in (not empty)
      // Handle both "name": "" and "name":"" formats
      const hasEmptyName = content.includes('"name": ""') || content.includes('"name":""');
      manifestConfigured = content.includes('"name":') && !hasEmptyName;
    } catch {
      manifestConfigured = false;
    }
  }

  // Check credentials
  const credentialsExist = fs.existsSync(envPath);

  // Check if connection was tested (we can infer from credentials + snapshots existing)
  const connectionTested = credentialsExist && fs.existsSync(siteIndexPath);

  // Check snapshots
  const snapshotsExist = fs.existsSync(siteIndexPath);

  // Check MCP config
  const mcpConfigured = fs.existsSync(mcpConfigPath);

  return {
    projectScaffolded,
    manifestExists,
    manifestConfigured,
    credentialsExist,
    connectionTested,
    snapshotsExist,
    mcpConfigured,
  };
}

/**
 * Generate AI onboarding handoff file with all 5 sections per spec
 */
export function generateAIHandoff(state: HandoffState): string {
  const timestamp = new Date().toISOString();
  const humanTimestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Section A: Setup Progress
  const sectionA = `## Section A: Setup Progress

What's been completed so far:

- [${state.projectScaffolded ? 'x' : ' '}] Project structure scaffolded
- [${state.manifestExists ? 'x' : ' '}] wpnavigator.jsonc created
- [${state.manifestConfigured ? 'x' : ' '}] Site details configured in manifest
- [${state.credentialsExist ? 'x' : ' '}] WordPress credentials saved (.wpnav.env)
- [${state.connectionTested ? 'x' : ' '}] WordPress connection tested
- [${state.snapshotsExist ? 'x' : ' '}] First snapshot generated
- [${state.mcpConfigured ? 'x' : ' '}] MCP configuration created`;

  // Section B: Key Project Files
  const sectionB = `## Section B: Key Project Files

These are the important files in this WP Navigator project:

| File | Purpose | Status |
|------|---------|--------|
| \`wpnavigator.jsonc\` | Site configuration and intent manifest | ${state.manifestExists ? '✓ exists' : '✗ missing'} |
| \`.wpnav.env\` | WordPress credentials (git-ignored) | ${state.credentialsExist ? '✓ exists' : '✗ missing'} |
| \`snapshots/site_index.json\` | Full site structure snapshot | ${state.snapshotsExist ? '✓ exists' : '✗ missing'} |
| \`snapshots/pages/\` | Individual page snapshots | directory |
| \`roles/\` | AI behaviour definitions (future) | directory |
| \`docs/README.md\` | Quick start guide | ${state.projectScaffolded ? '✓ exists' : '✗ missing'} |
| \`sample-prompts/\` | Ready-to-use AI prompts | directory |
| \`mcp-config.json\` | MCP server configuration | ${state.mcpConfigured ? '✓ exists' : '○ optional'} |`;

  // Section C: Next Steps for AI
  const nextSteps: string[] = [];

  if (!state.projectScaffolded) {
    nextSteps.push('Run `npx wpnav init --mode scaffold` to create project structure');
  }
  if (!state.credentialsExist) {
    nextSteps.push('Ask user for WordPress URL, username, and Application Password');
    nextSteps.push('Run `npx wpnav configure` to save credentials');
  }
  if (!state.connectionTested && state.credentialsExist) {
    nextSteps.push('Run `npx wpnav status` to verify WordPress connection');
  }
  if (!state.snapshotsExist && state.credentialsExist) {
    nextSteps.push('Run `npx wpnav snapshot site` to generate first snapshot');
  }
  if (!state.manifestConfigured && state.manifestExists) {
    nextSteps.push('Help user fill out site details in wpnavigator.jsonc');
  }
  if (state.snapshotsExist && state.manifestConfigured) {
    nextSteps.push('Run `npx wpnav validate` to check configuration');
    nextSteps.push('Run `npx wpnav diff` to compare manifest vs WordPress');
    nextSteps.push('Review sample-prompts/ for ready-to-use AI interactions');
  }
  if (!state.mcpConfigured && state.credentialsExist) {
    nextSteps.push('Optionally set up MCP for direct AI tool access');
  }

  // If everything is done, provide next-level steps
  if (state.projectScaffolded && state.credentialsExist && state.snapshotsExist && state.manifestConfigured) {
    nextSteps.push('Help user plan their first site changes');
    nextSteps.push('When ready, guide user through `npx wpnav sync --dry-run`');
  }

  const sectionC = `## Section C: Next Steps for AI

Complete these tasks in order:

${nextSteps.length > 0 ? nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n') : '✓ All setup steps complete! Ready for site management.'}`;

  // Section D: AI Instructions
  const sectionD = `## Section D: Instructions for AI Assistant

### You MAY:
- Edit \`wpnavigator.jsonc\` to update site configuration
- Suggest CLI commands (\`wpnav snapshot\`, \`wpnav configure\`, \`wpnav sync\`, etc.)
- Refine brand/style settings in the manifest
- Help interpret snapshot JSON files
- Create or edit files in \`docs/\` and \`sample-prompts/\`
- Explain what each file does and how they relate
- Guide the user through the sync workflow

### You MUST NOT:
- Access the user's WordPress site directly (all changes go through wpnav CLI)
- Invent files, endpoints, or commands that don't exist
- Modify \`.wpnav.env\` (contains credentials - user should use \`wpnav configure\`)
- Make destructive changes without explicit user consent
- Run \`wpnav sync\` without first running \`wpnav sync --dry-run\`
- Assume the WordPress plugin is installed without testing`;

  // Section E: Safety Notes
  const sectionE = `## Section E: Safety Notes

**Critical safety practices:**

1. **Snapshots are read-only** - They represent the current state of WordPress. Never modify snapshot files directly.

2. **Manifest is the source of truth** - All desired changes should be expressed in \`wpnavigator.jsonc\`. The AI edits the manifest, and \`wpnav sync\` applies it.

3. **Always preview before applying** - Run \`npx wpnav sync --dry-run\` before \`npx wpnav sync\` to see what will change.

4. **Minimal changes** - Propose the smallest possible change to achieve the user's goal. Don't refactor or "improve" things that weren't requested.

5. **Credentials are local-only** - The \`.wpnav.env\` file is git-ignored. Never ask the user to share its contents or commit it.

6. **Reversible operations** - Prefer changes that can be easily undone. WP Navigator creates pre-sync snapshots for rollback.`;

  // Combine all sections
  return `# WP Navigator AI Onboarding Handoff

> **Last Updated:** ${humanTimestamp}
> **Generated:** ${timestamp}

This file allows an AI assistant to continue WP Navigator setup from any point.
It is safe to commit to Git (contains no credentials).

---

${sectionA}

---

${sectionB}

---

${sectionC}

---

${sectionD}

---

${sectionE}

---

## Resources

- **Demo:** https://wpnav.ai/start/demo
- **Help:** https://wpnav.ai/help
- **Docs:** https://wpnav.ai/docs

---

*To regenerate this file with current progress: \`npx wpnav init --mode ai-handoff\`*
`;
}

// =============================================================================
// Scaffold Functions
// =============================================================================

/**
 * Check if file/directory already exists
 */
function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dirPath: string): boolean {
  if (exists(dirPath)) return false;
  fs.mkdirSync(dirPath, { recursive: true });
  return true;
}

/**
 * Write file if it doesn't exist
 */
function writeIfNotExists(filePath: string, content: string): boolean {
  if (exists(filePath)) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

/**
 * Scaffold the complete project structure
 */
async function scaffoldProject(cwd: string): Promise<ScaffoldResult> {
  const result: ScaffoldResult = {
    created: [],
    skipped: [],
    errors: [],
  };

  // Create directories
  for (const dir of PROJECT_DIRS) {
    const dirPath = path.join(cwd, dir);
    try {
      if (ensureDir(dirPath)) {
        result.created.push(dir + '/');
      } else {
        result.skipped.push(dir + '/');
      }
    } catch (err) {
      result.errors.push(`${dir}/: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Create wpnavigator.jsonc
  const manifestPath = path.join(cwd, 'wpnavigator.jsonc');
  try {
    if (writeIfNotExists(manifestPath, generateManifestTemplate())) {
      result.created.push('wpnavigator.jsonc');
    } else {
      result.skipped.push('wpnavigator.jsonc');
    }
  } catch (err) {
    result.errors.push(`wpnavigator.jsonc: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Create docs/README.md
  const docsReadmePath = path.join(cwd, 'docs', 'README.md');
  try {
    if (writeIfNotExists(docsReadmePath, generateDocsReadme())) {
      result.created.push('docs/README.md');
    } else {
      result.skipped.push('docs/README.md');
    }
  } catch (err) {
    result.errors.push(`docs/README.md: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Create .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  try {
    if (writeIfNotExists(gitignorePath, generateGitignore())) {
      result.created.push('.gitignore');
    } else {
      // Check if sensitive patterns are already in gitignore
      const existingGitignore = fs.readFileSync(gitignorePath, 'utf8');
      const appendContent = generateGitignoreAppend(existingGitignore);
      if (appendContent) {
        // Append missing patterns to existing gitignore
        fs.appendFileSync(gitignorePath, appendContent);
        result.created.push('.gitignore (updated)');
      } else {
        result.skipped.push('.gitignore');
      }
    }
  } catch (err) {
    result.errors.push(`.gitignore: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check for sensitive files already tracked in git
  const trackedSensitive = await checkTrackedSensitiveFiles(cwd);
  if (trackedSensitive.length > 0) {
    warning(`Sensitive files already tracked in git: ${trackedSensitive.join(', ')}`);
    info('  Run: git rm --cached <file> to untrack');
  }

  // Create .mcp.json (Claude Code project-level MCP config)
  const mcpJsonPath = path.join(cwd, '.mcp.json');
  try {
    if (writeIfNotExists(mcpJsonPath, generateMcpJson({ enableWrites: false }))) {
      result.created.push('.mcp.json');
    } else {
      result.skipped.push('.mcp.json');
    }
  } catch (err) {
    result.errors.push(`.mcp.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Create CLAUDE.md (AI assistant context)
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  try {
    const claudeMdContent = generateClaudeMd(getDefaultClaudeMdContext());
    if (writeIfNotExists(claudeMdPath, claudeMdContent)) {
      result.created.push('CLAUDE.md');
    } else {
      result.skipped.push('CLAUDE.md');
    }
  } catch (err) {
    result.errors.push(`CLAUDE.md: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Create sample prompts
  const prompts = generateSamplePrompts();
  for (const [filename, content] of Object.entries(prompts)) {
    const promptPath = path.join(cwd, 'sample-prompts', filename);
    try {
      if (writeIfNotExists(promptPath, content)) {
        result.created.push(`sample-prompts/${filename}`);
      } else {
        result.skipped.push(`sample-prompts/${filename}`);
      }
    } catch (err) {
      result.errors.push(`sample-prompts/${filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

/**
 * Display scaffold results with TUI formatting
 */
function displayScaffoldResults(result: ScaffoldResult): void {
  if (result.created.length > 0) {
    newline();
    info('Created:');
    for (const item of result.created) {
      success(item);
    }
  }

  if (result.skipped.length > 0) {
    newline();
    info('Already exists (skipped):');
    for (const item of result.skipped) {
      console.error(`  ${colorize(symbols.dash, 'dim')} ${item}`);
    }
  }

  if (result.errors.length > 0) {
    newline();
    errorMessage('Errors:');
    for (const item of result.errors) {
      errorMessage(item);
    }
  }
}

// =============================================================================
// URL Validation (Smart)
// =============================================================================

/**
 * Smart URL validation with auto-correction suggestions
 */
function smartValidateUrl(url: string): { valid: boolean; corrected?: string; warning?: string; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  let corrected = url.trim();

  // Auto-add https:// if missing protocol
  if (!corrected.startsWith('http://') && !corrected.startsWith('https://')) {
    corrected = 'https://' + corrected;
  }

  // Remove trailing slash
  corrected = corrected.replace(/\/+$/, '');

  // Validate URL format
  try {
    const parsed = new URL(corrected);
    if (!parsed.hostname) {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Warn if no TLD (might be localhost or local network)
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return {
        valid: true,
        corrected,
        warning: 'URL has no TLD (e.g., .com). This is fine for local development.',
      };
    }

    // Return corrected URL if different from input
    if (corrected !== url) {
      return { valid: true, corrected };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate Application Password format with feedback
 */
function validateAppPassword(password: string): { valid: boolean; feedback?: string; error?: string } {
  if (!password || password.trim() === '') {
    return { valid: false, error: 'Password is required' };
  }

  const cleaned = password.replace(/\s/g, '');

  // WordPress app passwords are typically 24 characters (6 groups of 4, with spaces)
  // But they can also be entered without spaces
  if (cleaned.length < 16) {
    return {
      valid: false,
      error: 'Password seems too short. WordPress Application Passwords are typically 24 characters.',
    };
  }

  // Check for typical app password format (letters and numbers only)
  if (/^[a-zA-Z0-9]+$/.test(cleaned)) {
    return {
      valid: true,
      feedback: 'Looks like a valid WordPress Application Password format.',
    };
  }

  // Non-standard format, allow but warn
  return {
    valid: true,
    feedback: 'Password format looks unusual, but we\'ll test it.',
  };
}

// =============================================================================
// Connection Testing
// =============================================================================

/**
 * Test connection to WordPress site via introspect endpoint
 * Detects plugin version, edition (Free/Pro), and MCP compatibility
 */
async function testConnection(
  siteUrl: string,
  username: string,
  password: string
): Promise<ConnectionTestResult> {
  // Use the plugin detection module for comprehensive detection
  const detection = await detectPlugin(siteUrl, username, password);

  if (!detection.detected) {
    return {
      success: false,
      error: detection.error || 'Plugin not detected',
    };
  }

  // Check MCP compatibility if mcp_compat is available
  let mcpCompatWarning: string | undefined;
  if (detection.mcpCompat && detection.version) {
    const compatResult = checkMcpCompatibility(detection.mcpCompat, detection.version);
    if (!compatResult.compatible) {
      mcpCompatWarning = compatResult.warning || compatResult.message;
    } else if (compatResult.warning) {
      mcpCompatWarning = compatResult.warning;
    }
  }

  return {
    success: true,
    siteName: detection.siteName || 'WordPress Site',
    pluginVersion: detection.version,
    pluginEdition: detection.edition,
    mcpCompatWarning,
  };
}

// =============================================================================
// .wpnav.env File Management
// =============================================================================

/**
 * Generate .wpnav.env content
 */
function generateWpnavEnvContent(siteUrl: string, username: string, password: string): string {
  const timestamp = new Date().toISOString();
  return `# WP Navigator Connection Settings
# Generated by wpnav init on ${timestamp}
#
# WARNING: This file contains sensitive credentials.
# It is automatically ignored by .gitignore.

# WordPress Site URL (without trailing slash)
WP_BASE_URL=${siteUrl}

# REST API endpoint
WP_REST_API=${siteUrl}/wp-json

# WP Navigator API base
WPNAV_BASE=${siteUrl}/wp-json/wpnav/v1

# Introspect endpoint
WPNAV_INTROSPECT=${siteUrl}/wp-json/wpnav/v1/introspect

# Application Password credentials
WP_APP_USER=${username}
WP_APP_PASS=${password}
`;
}

/**
 * Write .wpnav.env file atomically
 */
function writeWpnavEnvAtomic(filePath: string, content: string): void {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Create or update wpnav.config.json with detected plugin info
 */
function updateConfigWithDetectedPlugin(
  cwd: string,
  siteUrl: string,
  username: string,
  edition?: PluginEdition,
  version?: string
): void {
  const configPath = path.join(cwd, 'wpnav.config.json');

  // Build default config structure
  const config = {
    config_version: '1.0',
    default_environment: 'local',
    environments: {
      local: {
        site: siteUrl,
        user: username,
        password: '$WP_APP_PASS',
        ...(edition && version
          ? {
              detected_plugin: {
                edition,
                version,
                detected_at: new Date().toISOString(),
              },
            }
          : {}),
      },
    },
  };

  // If config already exists, try to update it
  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Update the local environment with detected plugin info
      if (existing.environments?.local && edition && version) {
        existing.environments.local.detected_plugin = {
          edition,
          version,
          detected_at: new Date().toISOString(),
        };
      }

      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    } catch {
      // If can't parse existing, overwrite with new
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    }
  } else {
    // Create new config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }
}

// =============================================================================
// MCP Configuration
// =============================================================================

/**
 * Generate MCP server configuration
 */
function generateMcpConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        wpnav: {
          command: 'npx',
          args: ['-y', '@littlebearapps/wp-navigator-mcp'],
          env: {
            WPNAV_CONFIG: './.wpnav.env',
          },
        },
      },
    },
    null,
    2
  );
}

/**
 * Generate AI setup guide for MCP
 */
function generateMcpSetupGuide(): string {
  return `# Setting Up WP Navigator MCP for AI Assistants

This guide explains how to connect WP Navigator to AI command-line tools.

## What is MCP?

MCP (Model Context Protocol) lets AI assistants like Claude Code and Codex
call WP Navigator tools directly. Instead of you running commands manually,
the AI can fetch data and suggest changes automatically.

## Setup for Claude Code

Add this to your Claude Code MCP settings:

\`\`\`json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp"],
      "env": {
        "WPNAV_CONFIG": "./.wpnav.env"
      }
    }
  }
}
\`\`\`

## Available Tools

Once connected, the AI can use tools like:
- \`wpnav_list_pages\` - List all pages
- \`wpnav_get_page\` - Get page details
- \`wpnav_list_plugins\` - List installed plugins
- \`wpnav_get_site_overview\` - Get full site summary

Run \`npx wpnav tools\` to see all available tools.

## Testing

After setup, ask the AI:
> "Use WP Navigator to show me my site's pages"

If MCP is configured correctly, it will fetch and display your pages.
`;
}

// =============================================================================
// Entry Screen
// =============================================================================

/**
 * Display entry screen and get user's choice
 */
async function showEntryScreen(): Promise<InitMode> {
  displayHeader();

  console.error('Welcome! Let\'s get your project ready.');
  newline();

  const choice = await selectPrompt({
    message: 'How would you like to set things up?',
    choices: [
      {
        label: 'Guided onboarding',
        value: 'guided',
        recommended: true,
      },
      {
        label: 'Just scaffold the files',
        value: 'scaffold',
      },
      {
        label: 'Let an AI assistant finish setup for me',
        value: 'ai-handoff',
      },
    ],
  });

  return choice as InitMode;
}

// =============================================================================
// Scaffold Mode Handler
// =============================================================================

/**
 * Handle scaffold-only mode
 */
async function handleScaffoldMode(cwd: string): Promise<void> {
  newline();
  info('Creating project structure...');
  newline();

  const result = await scaffoldProject(cwd);
  displayScaffoldResults(result);

  if (result.errors.length === 0) {
    newline();
    success('Project structure is ready!');
    newline();
    info('Next steps:');
    list([
      'Run "npx wpnav configure" to connect to your WordPress site.',
      'Run "npx wpnav snapshot site" to generate your first snapshots.',
      'Open this folder in Claude Code / Codex to start planning.',
    ]);
    newline();
    printResourceLinks('Resources:', ['demo', 'help']);
  }
}

// =============================================================================
// AI Handoff Mode Handler
// =============================================================================

/**
 * Write or regenerate the AI handoff file based on current state
 */
export function writeHandoffFile(cwd: string): boolean {
  const handoffPath = path.join(cwd, 'docs', 'ai-onboarding-handoff.md');
  const state = buildHandoffState(cwd);

  try {
    // Ensure docs directory exists
    const docsDir = path.join(cwd, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(handoffPath, generateAIHandoff(state), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle AI handoff mode
 */
async function handleAIHandoffMode(cwd: string): Promise<void> {
  newline();
  info('Setting up for AI handoff...');
  newline();

  // Scaffold basic structure first
  const scaffoldResult = await scaffoldProject(cwd);
  displayScaffoldResults(scaffoldResult);

  // Generate AI handoff file with current state
  const handoffPath = path.join(cwd, 'docs', 'ai-onboarding-handoff.md');

  if (writeHandoffFile(cwd)) {
    success('Created docs/ai-onboarding-handoff.md');
  } else {
    errorMessage('Failed to create handoff file');
  }

  newline();
  divider(50);
  newline();

  // Enhanced instructions for opening in AI tools
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  const checkmark = supportsColor() ? colorize('✓', 'green') : '*';

  console.error(`${checkmark} AI Handoff Ready!`);
  newline();

  info('Open this folder in your AI assistant:');
  newline();

  console.error(`  ${arrow} ${colorize('Claude Code', 'bold')}`);
  console.error('     cd to this directory, then run: claude');
  newline();

  console.error(`  ${arrow} ${colorize('Codex Cloud', 'bold')}`);
  console.error('     Upload this folder or connect via GitHub');
  newline();


  divider(50);
  newline();

  info('Then tell your AI:');
  newline();

  box(
    `"Read docs/ai-onboarding-handoff.md and help me
complete my WP Navigator setup."`,
    { title: 'Copy this prompt' }
  );

  newline();
  info('The AI will read the handoff file and guide you through the remaining steps.');
  newline();

  // Show what the AI will find
  const state = buildHandoffState(cwd);
  const pendingCount = [
    !state.credentialsExist,
    !state.connectionTested,
    !state.snapshotsExist,
    !state.manifestConfigured,
  ].filter(Boolean).length;

  if (pendingCount > 0) {
    info(`The AI will help you complete ${pendingCount} remaining step${pendingCount > 1 ? 's' : ''}.`);
  } else {
    success('All setup steps are complete! The AI can help you start managing your site.');
  }
  newline();
}

// =============================================================================
// Guided Mode - Step Handlers
// =============================================================================

/**
 * Step 1: Scaffold project files
 */
async function guidedStep1Scaffold(cwd: string): Promise<boolean> {
  displayStep(1, TOTAL_GUIDED_STEPS, 'Create project files');

  info('We\'ll create:');
  list([
    'wpnavigator.jsonc        (your site\'s configuration / intent)',
    'snapshots/               (where site snapshots will live)',
    'roles/                   (AI behaviour definitions)',
    'docs/README.md           (quick reference)',
    'sample-prompts/          (ready-to-use AI prompts)',
    '.gitignore               (ignores .wpnav.env for safety)',
  ]);
  newline();

  const confirm = await confirmPrompt({
    message: 'Create these files in the current directory?',
    defaultValue: true,
  });

  if (!confirm) {
    warning('Skipped creating project files');
    return false;
  }

  const result = await scaffoldProject(cwd);
  displayScaffoldResults(result);

  if (result.errors.length > 0) {
    errorMessage('Some files could not be created');
    return false;
  }

  newline();
  success('Project structure is ready!');
  return true;
}

/**
 * Step 2: Plugin installation instructions
 */
async function guidedStep2Plugin(): Promise<boolean> {
  displayStep(2, TOTAL_GUIDED_STEPS, 'Install WP Navigator plugin');

  info('WP Navigator needs a plugin installed on your WordPress site.');
  newline();
  console.error('  1. Log in to your WordPress admin');
  console.error('  2. Go to: Plugins → Add New → Upload Plugin');
  console.error('  3. Upload the WP Navigator plugin zip');
  console.error('  4. Click "Activate"');
  newline();
  info('Download the plugin at: https://wpnav.ai/download');
  newline();

  const response = await inputPrompt({
    message: 'Press Enter when done, or type "skip" to continue without plugin',
    defaultValue: '',
  });

  if (response.toLowerCase() === 'skip') {
    warning('Skipped plugin installation. Connection tests may fail.');
    return true; // Continue but note the skip
  }

  success('Great! Let\'s connect to your site.');
  return true;
}

/**
 * Step 3: Connect to WordPress
 */
interface ConnectResult {
  success: boolean;
  siteUrl?: string;
  pluginEdition?: PluginEdition;
  pluginVersion?: string;
}

async function guidedStep3Connect(cwd: string, options: { skipSmokeTest?: boolean } = {}): Promise<ConnectResult> {
  displayStep(3, TOTAL_GUIDED_STEPS, 'Connect to WordPress');

  info('We only store your details locally in a .wpnav.env file (which is git-ignored).');
  newline();

  // Get WordPress URL with smart validation
  let siteUrl = '';
  while (true) {
    const urlInput = await inputPrompt({
      message: 'WordPress URL (e.g. https://example.com)',
    });

    const urlResult = smartValidateUrl(urlInput);
    if (!urlResult.valid) {
      errorMessage(urlResult.error || 'Invalid URL');
      continue;
    }

    if (urlResult.corrected && urlResult.corrected !== urlInput) {
      info(`Auto-corrected to: ${urlResult.corrected}`);
    }

    if (urlResult.warning) {
      warning(urlResult.warning);
    }

    siteUrl = urlResult.corrected || urlInput;
    break;
  }

  // Get username
  const username = await inputPrompt({
    message: 'WordPress username (Administrator)',
    validate: (v) => (v.length < 2 ? 'Username must be at least 2 characters' : null),
  });

  // Get Application Password with validation
  newline();
  info(`Generate an Application Password at:`);
  info(`${siteUrl}/wp-admin/profile.php#application-passwords`);
  newline();

  let password = '';
  while (true) {
    password = await inputPrompt({
      message: 'Application Password',
      secret: true,
    });

    const passResult = validateAppPassword(password);
    if (!passResult.valid) {
      errorMessage(passResult.error || 'Invalid password');
      continue;
    }

    if (passResult.feedback) {
      success(passResult.feedback);
    }
    break;
  }

  // Test connection
  newline();
  const spinner = createSpinner({ text: 'Testing connection...' });
  const testResult = await testConnection(siteUrl, username, password);

  if (testResult.success) {
    spinner.succeed('Connection successful!');
    newline();
    keyValue('Site', testResult.siteName || 'WordPress Site');

    // Show edition-aware plugin info
    const editionLabel = testResult.pluginEdition === 'pro' ? 'Pro' : 'Free';
    const proNote = testResult.pluginEdition === 'pro' ? ' (Pro features available)' : '';
    keyValue('Plugin', `WP Navigator ${editionLabel} v${testResult.pluginVersion}${proNote}`);

    // Show MCP compatibility warning if applicable
    if (testResult.mcpCompatWarning) {
      newline();
      warning(`MCP Compatibility: ${testResult.mcpCompatWarning}`);
    }
  } else {
    spinner.fail('Connection failed');
    newline();
    errorMessage(testResult.error || 'Unknown error');
    newline();
    info('Troubleshooting tips:');
    list([
      'Check that WP Navigator plugin is installed and activated',
      'Verify the URL is correct and accessible',
      'Ensure the username has Administrator role',
      'Regenerate the Application Password if expired',
    ]);
    newline();

    const continueAnyway = await confirmPrompt({
      message: 'Save credentials anyway? (you can fix this later)',
      defaultValue: false,
    });

    if (!continueAnyway) {
      return { success: false };
    }
  }

  // Save .wpnav.env
  newline();
  const envPath = path.join(cwd, '.wpnav.env');
  try {
    writeWpnavEnvAtomic(envPath, generateWpnavEnvContent(siteUrl, username, password));
    success('Saved credentials to .wpnav.env');
  } catch (err) {
    errorMessage('Failed to save credentials', err instanceof Error ? err.message : undefined);
    return { success: false };
  }

  // Create/update wpnav.config.json with detected plugin info
  try {
    updateConfigWithDetectedPlugin(
      cwd,
      siteUrl,
      username,
      testResult.pluginEdition,
      testResult.pluginVersion
    );
    success('Created wpnav.config.json with plugin detection');
  } catch (err) {
    // Non-fatal: config is supplementary
    warning(`Could not save config: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Run smoke test to verify configuration works (unless skipped)
  if (!options.skipSmokeTest) {
    newline();
    const smokeSpinner = createSpinner({ text: 'Verifying connection...' });

    const smokeResult = await runSmokeTest(siteUrl, username, password);

    if (smokeResult.success) {
      smokeSpinner.succeed('Connection verified!');
      newline();
      displaySmokeTestResult(smokeResult);

      // Display graduation prompt with AI starter prompts
      await displayGraduationPrompt({
        siteUrl,
        siteName: smokeResult.siteName,
        pluginEdition: testResult.pluginEdition,
      });
    } else {
      smokeSpinner.fail('Connection test failed');
      newline();
      displaySmokeTestResult(smokeResult);

      // Offer to continue anyway since credentials are already saved
      newline();
      const continueAfterSmoke = await confirmPrompt({
        message: 'Continue with setup? (credentials are saved, you can fix this later)',
        defaultValue: true,
      });

      if (!continueAfterSmoke) {
        return { success: false };
      }
    }
  }

  return {
    success: true,
    siteUrl,
    pluginEdition: testResult.pluginEdition,
    pluginVersion: testResult.pluginVersion,
  };
}

/**
 * Step 4: Quick Start vs Full Setup
 */
async function guidedStep4Setup(cwd: string, siteUrl?: string): Promise<boolean> {
  displayStep(4, TOTAL_GUIDED_STEPS, 'Choose setup depth');

  const choice = await selectPrompt({
    message: 'How much do you want to configure now?',
    choices: [
      {
        label: 'Quick Start (20 seconds)',
        value: 'quick',
        recommended: true,
      },
      {
        label: 'Full Setup (brand, multiple pages)',
        value: 'full',
      },
    ],
  });

  if (choice === 'quick') {
    // Quick Start: Try to snapshot homepage
    newline();
    info('Taking your first snapshot...');

    // Check if we have valid connection
    const envPath = path.join(cwd, '.wpnav.env');
    if (!fs.existsSync(envPath)) {
      warning('No connection configured. Run "npx wpnav configure" first, then "npx wpnav snapshot site"');
      return true;
    }

    // Guide user to take snapshot manually for now
    // (Full implementation would call snapshot logic directly)
    newline();
    info('Run this command to capture your first snapshot:');
    console.error('');
    console.error(`  ${colorize('npx wpnav snapshot site', 'cyan')}`);
    console.error('');
    info('This will create snapshots/site_index.json with your site structure.');

    return true;
  } else {
    // Full Setup: Brand and style config
    newline();
    info('Let\'s configure your brand settings.');
    newline();

    // Read manifest to update
    const manifestPath = path.join(cwd, 'wpnavigator.jsonc');
    let manifestContent = '';
    try {
      manifestContent = fs.readFileSync(manifestPath, 'utf8');
    } catch {
      warning('Could not read wpnavigator.jsonc. Please configure brand settings manually.');
      return true;
    }

    const brandName = await inputPrompt({
      message: 'Brand/Site name',
      defaultValue: '',
    });

    const primaryColor = await inputPrompt({
      message: 'Primary color (hex, e.g. #0073aa)',
      defaultValue: '#0073aa',
      validate: (v) => {
        if (!v) return null; // Allow empty
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) return 'Enter a valid hex color (e.g. #0073aa)';
        return null;
      },
    });

    // Update manifest with brand info
    // Simple approach: update the site.name field
    if (brandName) {
      manifestContent = manifestContent.replace('"name": ""', `"name": "${brandName}"`);
    }
    if (primaryColor !== '#0073aa') {
      manifestContent = manifestContent.replace(
        '// "primary_color": "#0073aa"',
        `"primary_color": "${primaryColor}"`
      );
    }

    try {
      fs.writeFileSync(manifestPath, manifestContent, 'utf8');
      success('Updated wpnavigator.jsonc with brand settings');
    } catch (err) {
      errorMessage('Failed to update manifest', err instanceof Error ? err.message : undefined);
    }

    newline();
    info('Run this command to capture your site:');
    console.error('');
    console.error(`  ${colorize('npx wpnav snapshot site', 'cyan')}`);
    console.error('');

    return true;
  }
}

/**
 * Step 5: Optional MCP setup and final summary
 */
async function guidedStep5Summary(cwd: string): Promise<void> {
  displayStep(5, TOTAL_GUIDED_STEPS, 'Final setup');

  // Ask about MCP
  const setupMcp = await confirmPrompt({
    message: 'Set up MCP for AI assistants? (Claude Code, Codex)',
    defaultValue: false,
  });

  if (setupMcp) {
    const mcpConfigPath = path.join(cwd, 'mcp-config.json');
    const mcpGuidePath = path.join(cwd, 'docs', 'ai-setup-wpnavigator.md');

    try {
      fs.writeFileSync(mcpConfigPath, generateMcpConfig(), 'utf8');
      success('Created mcp-config.json');
    } catch (err) {
      errorMessage('Failed to create MCP config', err instanceof Error ? err.message : undefined);
    }

    try {
      fs.writeFileSync(mcpGuidePath, generateMcpSetupGuide(), 'utf8');
      success('Created docs/ai-setup-wpnavigator.md');
    } catch (err) {
      errorMessage('Failed to create MCP guide', err instanceof Error ? err.message : undefined);
    }
  } else {
    info('You can run "npx wpnav init --mcp" later to set up MCP support.');
  }

  // Final summary
  newline();
  divider(50);
  newline();

  const celebration = supportsColor() ? '\ud83c\udf89' : '';
  console.error(`${celebration} All done!`);
  newline();

  // Show write mode status (writes disabled by default for safety)
  modeIndicator(false);
  newline();

  info('Here\'s what we\'ve set up for you:');
  newline();
  list([
    'wpnavigator.jsonc   (your site\'s configuration / intent)',
    'snapshots/          (structured data about your site)',
    'roles/              (reserved for future AI roles)',
    'sample-prompts/     (ready-to-use AI prompts)',
    '.wpnav.env          (local-only WordPress credentials)',
  ]);

  newline();
  divider(50);
  newline();

  info('Next steps:');
  newline();
  console.error('  1. Open this folder in Claude Code or Codex Cloud');
  console.error('  2. Run: npx wpnav snapshot site');
  console.error('  3. Show the AI:');
  console.error('     - wpnavigator.jsonc');
  console.error('     - snapshots/site_index.json');
  console.error('  4. Ask: "Help me review and refine my WP Navigator config"');
  console.error('  5. When ready: npx wpnav sync');

  newline();
  divider(50);
  newline();

  info('Tip: Use sample-prompts/self-test.txt to verify your setup:');
  console.error('     Copy the prompt into your AI assistant to run a comprehensive');
  console.error('     validation of your WP Navigator configuration.');

  newline();
  printResourceLinks('Resources:', ['demo', 'help', 'docs']);
  newline();
}

// =============================================================================
// JSON Output Functions
// =============================================================================

/**
 * Output JSON result to stdout
 */
function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Handle init in JSON mode (non-interactive)
 * Requires --mode (scaffold or ai-handoff) or credentials for guided mode
 */
async function handleInitJson(cwd: string, options: InitOptions): Promise<number> {
  const result: InitResult = {
    success: false,
    mode: options.mode || 'scaffold',
    files_created: [],
    files_skipped: [],
    errors: [],
  };

  // Determine mode
  let mode: InitMode = options.mode || 'scaffold';

  // For guided mode in JSON, credentials are required
  if (mode === 'guided') {
    if (!options.siteUrl || !options.username || !options.password) {
      outputJSON({
        success: false,
        command: 'init',
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'JSON mode with guided requires --site, --user, and --password flags',
          details: {
            provided: {
              site: !!options.siteUrl,
              user: !!options.username,
              password: !!options.password,
            },
          },
        },
      });
      return 1;
    }
  }

  // Scaffold project structure
  const scaffoldResult = await scaffoldProject(cwd);
  result.files_created.push(...scaffoldResult.created);
  result.files_skipped.push(...scaffoldResult.skipped);
  result.errors.push(...scaffoldResult.errors);

  // If ai-handoff mode, generate handoff file
  if (mode === 'ai-handoff') {
    writeHandoffFile(cwd);
    result.files_created.push('docs/ai-onboarding-handoff.md');
  }

  // If guided mode with credentials, save credentials and test connection
  if (mode === 'guided' && options.siteUrl && options.username && options.password) {
    // Save credentials
    const envPath = path.join(cwd, '.wpnav.env');
    try {
      const envContent = generateWpnavEnvContent(options.siteUrl, options.username, options.password);
      writeWpnavEnvAtomic(envPath, envContent);
      result.files_created.push('.wpnav.env');
    } catch (err) {
      result.errors.push(`.wpnav.env: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test connection unless skipped
    if (!options.skipSmokeTest) {
      const testResult = await testConnection(options.siteUrl, options.username, options.password);
      if (testResult.success) {
        result.connection = {
          site_url: options.siteUrl,
          site_name: testResult.siteName,
          plugin_edition: testResult.pluginEdition,
          plugin_version: testResult.pluginVersion,
        };
      } else {
        result.errors.push(`Connection test failed: ${testResult.error}`);
      }
    } else {
      result.connection = {
        site_url: options.siteUrl,
      };
    }

    // Write handoff file with state
    writeHandoffFile(cwd);
  }

  // Determine success
  result.success = result.errors.length === 0;
  result.mode = mode;

  outputJSON({
    success: result.success,
    command: 'init',
    data: {
      mode: result.mode,
      files_created: result.files_created,
      files_skipped: result.files_skipped,
      connection: result.connection,
      errors: result.errors.length > 0 ? result.errors : undefined,
    },
  });

  return result.success ? 0 : 1;
}

/**
 * Handle init in express mode (TUI output, non-interactive)
 * Requires --site, --user, --password flags
 */
async function handleInitExpress(cwd: string, options: InitOptions): Promise<number> {
  // Validate required credentials
  if (!options.siteUrl || !options.username || !options.password) {
    errorMessage('Express mode requires --site, --user, and --password flags');
    newline();
    info('Example:');
    console.error('  wpnav init --express --site https://example.com --user admin --password "xxxx xxxx xxxx xxxx"');
    return 1;
  }

  // Detect environment and get defaults
  const isLocal = isLocalUrl(options.siteUrl);
  const defaults = getExpressDefaults({
    siteUrl: options.siteUrl,
    isLocal,
  });

  // Display express mode header
  newline();
  box('WP Navigator Express Setup', { title: 'Express Mode' });
  newline();

  // Log applied defaults
  info(describeDefaults(defaults));
  newline();
  console.error(formatAppliedDefaults(defaults));
  newline();

  // Step 1: Scaffold project
  const scaffoldSpinner = createSpinner({ text: 'Scaffolding project structure...' });
  const scaffoldResult = await scaffoldProject(cwd);
  if (scaffoldResult.errors.length > 0) {
    scaffoldSpinner.fail('Scaffolding failed');
    for (const err of scaffoldResult.errors) {
      errorMessage(err);
    }
    return 1;
  }
  scaffoldSpinner.succeed(`Created ${scaffoldResult.created.length} files/directories`);

  // Step 2: Save credentials
  const credSpinner = createSpinner({ text: 'Saving credentials...' });
  const envPath = path.join(cwd, '.wpnav.env');
  try {
    const envContent = generateWpnavEnvContent(options.siteUrl, options.username, options.password);
    writeWpnavEnvAtomic(envPath, envContent);
    credSpinner.succeed('Credentials saved to .wpnav.env');
  } catch (err) {
    credSpinner.fail('Failed to save credentials');
    errorMessage(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Step 3: Test connection (unless skipped)
  let connectionResult: ConnectionTestResult | undefined;
  if (!options.skipSmokeTest) {
    const testSpinner = createSpinner({ text: 'Testing connection...' });
    connectionResult = await testConnection(options.siteUrl, options.username, options.password);

    if (connectionResult.success) {
      testSpinner.succeed('Connection verified!');
      newline();
      displaySmokeTestResult({
        success: true,
        siteName: connectionResult.siteName,
        pluginVersion: connectionResult.pluginVersion,
        pluginEdition: connectionResult.pluginEdition,
      });
    } else {
      testSpinner.warn('Connection test failed (setup completed anyway)');
      warning(connectionResult.error || 'Unknown error');
    }
  } else {
    info('Skipped connection test (--skip-smoke-test)');
  }

  // Write handoff file with state
  writeHandoffFile(cwd);

  // Summary
  newline();
  success('Express setup complete!');
  newline();

  // Show write mode status (writes disabled by default for safety)
  modeIndicator(false);
  newline();

  info('Files created:');
  list(scaffoldResult.created);
  newline();
  info('Next steps:');
  list([
    'Configure your AI assistant with .mcp.json',
    'Run "wpnav status" to verify connection',
    'Edit wpnavigator.jsonc to define your site structure',
  ]);

  return 0;
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle the init command
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleInit(options: InitOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const isJson = options.json === true;
  const isExpress = options.express === true;

  // JSON mode: non-interactive, use handleInitJson
  if (isJson) {
    return handleInitJson(cwd, options);
  }

  // Express mode: non-interactive TUI, use handleInitExpress
  if (isExpress) {
    return handleInitExpress(cwd, options);
  }

  // Check if already initialized
  const manifestExists = fs.existsSync(path.join(cwd, 'wpnavigator.jsonc'));

  if (manifestExists && !options.skipConfirm) {
    warning('This directory already has a wpnavigator.jsonc file.');
    newline();
    const continueInit = await confirmPrompt({
      message: 'Continue anyway? (existing files will be preserved)',
      defaultValue: false,
    });
    if (!continueInit) {
      info('Init cancelled. Use "npx wpnav configure" to update credentials.');
      return 0;
    }
  }

  // Determine mode
  let mode = options.mode;
  if (!mode) {
    mode = await showEntryScreen();
  }

  // Handle based on mode
  switch (mode) {
    case 'scaffold':
      await handleScaffoldMode(cwd);
      break;

    case 'ai-handoff':
      await handleAIHandoffMode(cwd);
      break;

    case 'guided':
    default: {
      // Step 1: Scaffold
      const scaffoldOk = await guidedStep1Scaffold(cwd);
      if (!scaffoldOk) {
        // User cancelled, but continue to let them configure
        warning('Continuing without scaffolding...');
      }
      // Regenerate handoff file to reflect scaffolding
      writeHandoffFile(cwd);

      // Step 2: Plugin instructions
      await guidedStep2Plugin();

      // Step 3: Connect to WordPress
      const connectResult = await guidedStep3Connect(cwd, { skipSmokeTest: options.skipSmokeTest });
      // Regenerate handoff file to reflect credentials saved
      writeHandoffFile(cwd);

      // Step 4: Quick Start vs Full Setup
      await guidedStep4Setup(cwd, connectResult.siteUrl);
      // Regenerate handoff file to reflect setup choices
      writeHandoffFile(cwd);

      // Step 5: MCP and Summary
      await guidedStep5Summary(cwd);
      // Final handoff file regeneration with complete state
      writeHandoffFile(cwd);
      break;
    }
  }

  return 0;
}

export default handleInit;
