#!/bin/bash
# Check for Docker/wp-env dependencies in MCP tools
# Run from wp-navigator-mcp directory

echo "=== Checking MCP tools for Docker/wp-env dependencies ==="
echo ""

# Check tools directory for any shell execution
echo "1. Checking src/tools/ for child_process/exec/spawn..."
TOOLS_DEPS=$(grep -rn "child_process\|execAsync\|exec(\|spawn" src/tools/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOOLS_DEPS" -eq 0 ]; then
  echo "   ✅ No shell execution found in tools"
else
  echo "   ❌ Found $TOOLS_DEPS references:"
  grep -rn "child_process\|execAsync\|exec(\|spawn" src/tools/
fi
echo ""

# Check for wp-env run commands
echo "2. Checking for 'wp-env run' commands..."
WPENV_RUN=$(grep -rn "wp-env run\|npx wp-env" src/tools/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$WPENV_RUN" -eq 0 ]; then
  echo "   ✅ No wp-env run commands found"
else
  echo "   ❌ Found $WPENV_RUN references:"
  grep -rn "wp-env run\|npx wp-env" src/tools/
fi
echo ""

# Check for docker exec commands
echo "3. Checking for docker exec commands..."
DOCKER_EXEC=$(grep -rn "docker exec\|docker run" src/tools/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOCKER_EXEC" -eq 0 ]; then
  echo "   ✅ No docker exec commands found"
else
  echo "   ❌ Found $DOCKER_EXEC references:"
  grep -rn "docker exec\|docker run" src/tools/
fi
echo ""

# Summary
echo "=== Summary ==="
TOTAL=$((TOOLS_DEPS + WPENV_RUN + DOCKER_EXEC))
if [ "$TOTAL" -eq 0 ]; then
  echo "✅ All MCP tools are Docker-free and work with any WordPress instance"
else
  echo "❌ Found $TOTAL Docker/wp-env dependencies that need migration"
fi
