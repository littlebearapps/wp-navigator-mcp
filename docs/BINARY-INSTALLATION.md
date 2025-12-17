# Binary Installation Guide

**WP Navigator MCP** is available as standalone executables that don't require Node.js. Perfect for users who want a simple installation without managing npm dependencies.

---

## Quick Start

### 1. Download

Download the appropriate binary for your platform from the [latest release](https://github.com/littlebearapps/wp-navigator-mcp/releases/latest):

| Platform | File | Architecture |
|----------|------|--------------|
| macOS (Apple Silicon) | `wpnav-macos-arm64-{version}` | M1/M2/M3 chips |
| macOS (Intel) | `wpnav-macos-x64-{version}` | Intel processors |
| Linux | `wpnav-linux-x64-{version}` | x86_64 |
| Windows | `wpnav-windows-x64-{version}.exe` | x86_64 |

### 2. Install

#### macOS

```bash
# Download (replace VERSION with actual version, e.g., 2.7.0)
curl -L -o wpnav "https://github.com/littlebearapps/wp-navigator-mcp/releases/download/v${VERSION}/wpnav-macos-arm64-${VERSION}"

# Make executable
chmod +x wpnav

# Remove quarantine flag (Gatekeeper)
xattr -d com.apple.quarantine wpnav

# Move to PATH (optional)
sudo mv wpnav /usr/local/bin/

# Verify
wpnav --version
```

**Note**: The `xattr` command removes the quarantine flag that macOS applies to downloaded files. This is required because the binary is not notarized by Apple.

#### Linux

```bash
# Download (replace VERSION with actual version)
curl -L -o wpnav "https://github.com/littlebearapps/wp-navigator-mcp/releases/download/v${VERSION}/wpnav-linux-x64-${VERSION}"

# Make executable
chmod +x wpnav

# Move to PATH (optional)
sudo mv wpnav /usr/local/bin/

# Verify
wpnav --version
```

#### Windows

1. Download `wpnav-windows-x64-{version}.exe` from releases
2. Rename to `wpnav.exe` (optional)
3. Move to a folder in your PATH, or add the folder to PATH
4. Open PowerShell and verify:

```powershell
wpnav.exe --version
```

---

## Verify Download (Recommended)

Each release includes `checksums-{version}.txt` with SHA256 hashes.

```bash
# Download checksums
curl -L -o checksums.txt "https://github.com/littlebearapps/wp-navigator-mcp/releases/download/v${VERSION}/checksums-${VERSION}.txt"

# Verify (macOS/Linux)
shasum -a 256 -c checksums.txt --ignore-missing

# Or manually verify
shasum -a 256 wpnav
cat checksums.txt | grep wpnav-macos-arm64
```

---

## Usage

### CLI Mode

The binary supports all CLI commands:

```bash
# Show help
wpnav --help

# Initialize a new project
wpnav init

# List available tools
wpnav tools

# Check WordPress connection
wpnav status

# Call a tool directly
wpnav call wpnav_list_posts --limit 5
```

### MCP Server Mode

To use as an MCP server with Claude Code or other clients, create a configuration file:

**Claude Code (`.mcp.json`)**:
```json
{
  "mcpServers": {
    "wpnav": {
      "command": "/path/to/wpnav",
      "args": ["./wpnav.config.json"],
      "env": {
        "WPNAV_ENABLE_WRITES": "0"
      }
    }
  }
}
```

Replace `/path/to/wpnav` with the actual binary path.

---

## Configuration

Create `wpnav.config.json` in your project:

```json
{
  "config_version": "1.0",
  "environments": {
    "local": {
      "site": "http://localhost:8080",
      "user": "admin",
      "password": "$WPNAV_APP_PASSWORD"
    },
    "production": {
      "site": "https://your-site.com",
      "user": "your-username",
      "password": "$WPNAV_APP_PASSWORD"
    }
  }
}
```

Set the password via environment variable:
```bash
export WPNAV_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

---

## Updating

To update to a new version:

1. Download the new binary from releases
2. Replace the existing binary
3. Verify with `wpnav --version`

---

## Troubleshooting

### macOS: "Cannot be opened because the developer cannot be verified"

Run the following command to remove the quarantine flag:
```bash
xattr -d com.apple.quarantine wpnav
```

Or right-click the binary → Open → Open anyway.

### macOS: "Operation not permitted" when removing quarantine

Make sure you're running the command on the binary file, not a directory:
```bash
xattr -d com.apple.quarantine /path/to/wpnav
```

### Linux: "Permission denied"

Ensure the binary is executable:
```bash
chmod +x wpnav
```

### Windows: "not recognized as an internal or external command"

Either:
- Use the full path: `C:\path\to\wpnav.exe --version`
- Add the binary's folder to your PATH environment variable

### Binary doesn't work after download

1. Verify the download with checksums (see above)
2. Make sure you downloaded the correct architecture:
   - macOS: `arm64` for M1/M2/M3, `x64` for Intel
   - Use `uname -m` to check your architecture

---

## Building from Source

To build binaries locally (requires [Bun](https://bun.sh)):

```bash
# Clone repository
git clone https://github.com/littlebearapps/wp-navigator-mcp.git
cd wp-navigator-mcp

# Install dependencies
npm install

# Build for current platform
npm run build:binary:local

# Build all platforms
npm run build:binary

# Test binary
npm run test:binary
```

Output: `dist/binary/wpnav-{version}-{platform}`

---

## npm Alternative

If you prefer npm or need automatic updates, use:

```bash
npx @littlebearapps/wp-navigator-mcp --help
```

Or install globally:

```bash
npm install -g @littlebearapps/wp-navigator-mcp
wpnav --help
```

---

## Support

- **Documentation**: https://wpnav.ai/docs
- **Issues**: https://github.com/littlebearapps/wp-navigator-mcp/issues
- **Discussions**: https://github.com/littlebearapps/wp-navigator-mcp/discussions
