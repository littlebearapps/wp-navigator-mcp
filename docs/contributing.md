# Contributing to WP Navigator MCP

Thank you for your interest in contributing! This document explains how to get started.

---

## Code of Conduct

Be respectful and constructive. We welcome contributors of all experience levels.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Git

### Development Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/wp-navigator-mcp.git
cd wp-navigator-mcp

# 3. Install dependencies
npm install

# 4. Build the project
npm run build

# 5. Run tests
npm test
```

### Development Workflow

```bash
# Watch mode - rebuilds on file changes
npm run dev

# Run tests in watch mode
npm run test:watch

# Check types without emitting
npm run typecheck

# Lint code
npm run lint
```

---

## Project Structure

```
wp-navigator-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── cli.ts                # CLI entry point
│   ├── tool-registry/        # Tool registration system
│   │   ├── registry.ts       # Central registry
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── utils.ts          # Validation utilities
│   ├── tools/                # Tool implementations
│   │   ├── core/             # introspect, help, site_overview
│   │   ├── content/          # posts, pages, media
│   │   ├── taxonomy/         # categories, tags
│   │   ├── plugins/          # plugin management
│   │   ├── themes/           # theme management
│   │   └── gutenberg/        # block editor
│   └── cli/
│       └── tui/              # Terminal UI components
├── tests/                    # Test files
├── docs/                     # Documentation
└── .github/                  # GitHub templates and workflows
```

---

## Code Style

### TypeScript

- **Strict mode** - All code must pass strict TypeScript checks
- **Explicit types** - Prefer explicit type annotations over inference for public APIs
- **No `any`** - Use `unknown` and type guards instead

### Formatting

We use Prettier for code formatting. Format before committing:

```bash
npm run format
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Tool names**: `wpnav_snake_case`

---

## Adding a New Tool

1. **Create tool file** in appropriate category (`src/tools/[category]/`):

```typescript
// src/tools/content/my-new-tool.ts
import { toolRegistry, ToolCategory } from '../../tool-registry';
import { validateRequired, validateId } from '../../tool-registry/utils';

toolRegistry.register({
  definition: {
    name: 'wpnav_my_new_tool',
    description: 'Brief description of what this tool does',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Resource ID' },
      },
      required: ['id'],
    },
  },
  handler: async (args, context) => {
    validateRequired(args, ['id']);
    validateId(args.id, 'id');

    const result = await context.wpRequest(`/wp/v2/resource/${args.id}`);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
  category: ToolCategory.CONTENT,
});
```

2. **Export from category index**:

```typescript
// src/tools/content/index.ts
export * from './my-new-tool';
```

3. **Add tests**:

```typescript
// src/tools/content/my-new-tool.test.ts
import { describe, it, expect } from 'vitest';

describe('wpnav_my_new_tool', () => {
  it('should validate required parameters', async () => {
    // Test implementation
  });
});
```

4. **Update authority file**:

```bash
npm run generate:authority
```

---

## Testing

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Specific file
npm test -- src/tools/content/my-new-tool.test.ts

# Watch mode
npm run test:watch
```

### Writing Tests

- Use [Vitest](https://vitest.dev/) for testing
- Mock WordPress API responses
- Test both success and error cases
- Test input validation

---

## Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `ci` | CI/CD changes |

### Examples

```bash
feat(tools): add wpnav_bulk_update_posts tool

fix(auth): handle expired application passwords

docs: update CLI reference with new commands

chore(deps): update vitest to v2.0
```

---

## Pull Request Process

### Before Submitting

- [ ] Fork the repository
- [ ] Create a feature branch: `git checkout -b feat/my-feature`
- [ ] Make your changes
- [ ] Run tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Commit with conventional commit message

### Submitting

1. Push to your fork: `git push origin feat/my-feature`
2. Open a Pull Request against `main`
3. Fill out the PR template
4. Wait for CI checks to pass
5. Address review feedback

### PR Requirements

- All tests pass
- No linting errors
- TypeScript compiles without errors
- Conventional commit message
- Documentation updated if needed
- CHANGELOG.md updated for user-facing changes

### Branch Protection

The `main` branch is protected with the following requirements:

| Check | Description |
|-------|-------------|
| **build-and-test** | TypeScript build + test suite |
| **security-audit** | npm audit for vulnerabilities |
| **Supply Chain Scan** | Socket.dev supply chain analysis |
| **1 approval** | Maintainer review required |

PRs cannot be merged until all checks pass and a maintainer approves.

---

## Changelog Format

We follow [Keep a Changelog](https://keepachangelog.com/). When adding entries:

```markdown
## [Unreleased]

### Added
- New `wpnav_my_tool` for doing X (#123)

### Changed
- Improved error messages for authentication failures

### Fixed
- Fixed timeout issue with large media uploads (#456)
```

---

## Issue Guidelines

### Bug Reports

Use the [bug report template](https://github.com/littlebearapps/wp-navigator-mcp/issues/new?template=bug_report.yml):

- Include MCP client and version
- Steps to reproduce
- Expected vs actual behavior
- Error logs if available

### Feature Requests

Use the [feature request template](https://github.com/littlebearapps/wp-navigator-mcp/issues/new?template=feature_request.yml):

- Describe the problem you're solving
- Propose a solution
- Consider alternatives

---

## Release Process

### Dual-Repository Structure

This project uses a dual-repo structure:
- **Public repo** (`littlebearapps/wp-navigator-mcp`): Source code, issues, discussions
- **Private master repo**: Development, internal docs, backlog

**External contributors** submit PRs to the public repo. Maintainers review and apply changes to the internal repo, which then syncs back to public on release.

### How Releases Work

We use [Release Please](https://github.com/googleapis/release-please) for automated releases:

1. **Conventional commits** trigger changelog updates
2. **Release Please** creates a release PR with version bump and changelog
3. **Merging the release PR** triggers the release workflow:
   - Creates GitHub Release in master repo
   - Syncs filtered content to public repo
   - Creates matching release in public repo
   - Publishes to npm with provenance attestation
   - Posts announcement to Discussions

### Milestones

Issues and PRs are organized into [milestones](https://github.com/littlebearapps/wp-navigator-mcp/milestones):

- **Closed milestones** document completed releases (v1.0.0, v2.0.0, v2.1.0)
- **Open milestones** track upcoming releases

When working on an issue:
1. Maintainers assign issues to milestones during triage
2. PRs linked to issues inherit milestone tracking
3. Check [all milestones](https://github.com/littlebearapps/wp-navigator-mcp/milestones?state=all) for history

### Linking Issues to Changelog

Reference issues in your commits and PRs:

```bash
# In commit message
fix(auth): handle expired passwords (#123)

# In PR description
Fixes #123
Closes #456
```

Release Please automatically includes these references in the changelog.

---

## For Maintainers: Handling External PRs

When a contributor submits a PR to the public repo:

1. **Review the PR** in the public repo as normal
2. **If approved**, apply changes to the master repo:
   ```bash
   # In master repo
   git fetch https://github.com/CONTRIBUTOR/wp-navigator-mcp.git BRANCH
   git cherry-pick COMMIT_SHA
   # Or apply as patch
   ```
3. **Close the public PR** with a comment:
   > Thank you for your contribution! Applied to internal repository. Will be included in the next release.
4. **Credit the contributor** in the commit message:
   ```
   feat: add new feature (#PR_NUMBER)

   Co-authored-by: Contributor Name <email@example.com>
   ```

The next release will automatically sync the changes back to the public repo.

---

## Questions?

- **Discussions**: [GitHub Discussions](https://github.com/littlebearapps/wp-navigator-mcp/discussions)
- **Documentation**: [wpnav.ai/docs](https://wpnav.ai/docs)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
