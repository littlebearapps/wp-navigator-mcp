# Quick Commands Reference

**Common commands for wp-navigator-mcp development**

---

## Development

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode (rebuild on changes)
npm run dev

# Test coverage
npm run test:coverage

# Generate tool authority file
npm run generate:authority
```

---

## Running the Server

```bash
# With config file
npm start ./wp-config.json

# Via npx (latest)
npx -y @littlebearapps/wp-navigator-mcp ./wp-config.json

# Via npx (specific version)
npx @littlebearapps/wp-navigator-mcp@1.0.1 ./wp-config.json

# Clear npx cache if stale
npm cache clean --force
```

---

## Publishing

```bash
# Bump version (triggers CI publish)
npm version patch   # Bug fixes: 1.0.1 -> 1.0.2
npm version minor   # New tools: 1.0.2 -> 1.1.0
npm version major   # Breaking: 1.1.0 -> 2.0.0

# Push with tags
git push --follow-tags

# Verify published version
npm view @littlebearapps/wp-navigator-mcp version
```

---

## Tool Authority

```bash
# Regenerate from source code
npm run generate:authority

# View tool count
grep "name:" docs/MCP-TOOL-AUTHORITY.yaml | wc -l

# Search for specific tool
grep -A5 "wpnav_list_posts" docs/MCP-TOOL-AUTHORITY.yaml
```

---

## Git & MCP

```bash
# Check MCP connection (in Claude Code)
/mcp

# Create feature branch
git checkout -b feature/my-feature

# Conventional commit
git commit -m "feat: add new tool"
git commit -m "fix: resolve validation bug"

# Check status
git status
```

---

## Testing WordPress Connection

```bash
# Test introspect endpoint
curl -s -u "username:app-password" \
  "https://your-site.com/wp-json/wpnav/v1/introspect" | jq '.plugin'

# Test REST API
curl -s -u "username:app-password" \
  "https://your-site.com/wp-json/wp/v2/posts?per_page=1" | jq '.[0].title'
```

---

## Debugging

```bash
# Enable HTTP timing
WPNAV_DEBUG_HTTP_TIMING=1 npm start ./wp-config.json

# Check startup output
npm start ./wp-config.json 2>&1 | head -30

# Verbose test output
npm test -- --reporter=verbose
```

---

## Backlog Tasks

```bash
# List tasks (via MCP)
mcp__backlog__task_list

# Create task
mcp__backlog__task_create with title, description, labels

# Update task status
mcp__backlog__task_edit with id, status: "In Progress"
```

---

**Last Updated**: 2025-12-04
