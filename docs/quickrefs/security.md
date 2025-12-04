# Security Guide - WP Navigator MCP Server

**Purpose**: Security practices for the local MCP server (Node/STDIO)

---

## Core Principles

- **Minimum privilege**: Only capabilities and tools required for the task
- **Secure by default**: Writes disabled unless explicitly enabled; HTTPS for non-localhost
- **Safety first**: Plan-diff-apply workflow; backups + rollback; idempotency keys
- **Never log secrets**: Redact credentials and tokens at source

---

## Required Practices

### Single-Origin Allowlist (SSRF Guard)

- Treat `WP_REST_API`/`WPNAV_BASE` as the only allowed origin
- Build requests relative to that base
- Reject off-origin URLs and non-HTTP(S) schemes

### Strict Input Validation

- Validate tool args with JSON Schema
- Use `maxLength`, `maxItems` constraints
- Sanitise all user-provided content

### Safe-by-Default Writes

- Default to read-only unless `WPNAV_ENABLE_WRITES=1`
- Route all writes through plugin apply endpoints
- Use idempotency keys and backup semantics

### Timeouts, Retries, Throttling

- AbortController timeouts per request
- Retry only on 429/5xx with exponential backoff
- Honour `Retry-After` headers
- Token bucket rate limiting

### Transport Security

- Require HTTPS for non-localhost
- Allow `ALLOW_INSECURE_HTTP=1` for local dev only
- TLS 1.2 minimum
- Optional `WPNAV_CA_BUNDLE` for custom CA chains

### Secrets & Logging

- Redact `WP_APP_PASS`, bearer tokens, Authorization headers
- No persisted secrets in logs or output
- Use environment variables, not config files for secrets

### Output Clamping

- Enforce `WPNAV_MAX_RESPONSE_KB` (default 64KB)
- Return artifact URLs for large results
- Truncate verbose responses

### Concurrency Guard

- Limit in-flight writes (1 by default)
- Align with lease/rollback guarantees
- Prevent race conditions on destructive operations

### Typed Errors

Map plugin codes to MCP errors with `data.code`:
- `SITE_FROZEN`
- `LEASE_HELD`
- `POLICY_DENY`
- `RATE_LIMITED`
- `CONTENT_CONFLICT`

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WPNAV_ENABLE_WRITES` | `0` | Enable write operations |
| `ALLOW_INSECURE_HTTP` | `0` | Allow HTTP for localhost dev |
| `WPNAV_MAX_RESPONSE_KB` | `64` | Max response size |
| `WPNAV_TOOL_TIMEOUT_MS` | `600000` | Per-tool timeout (10 min) |
| `WPNAV_CA_BUNDLE` | - | Custom CA certificate path |

---

## Hardening Checklist

- [ ] Writes disabled by default; apply flow enforced
- [ ] JSON Schema validation on all tool inputs
- [ ] HTTPS enforced for non-localhost
- [ ] Secrets redacted in logs; no PII
- [ ] Max response size clamped
- [ ] Rate limits and concurrency guard working
- [ ] Typed errors surfaced to client
- [ ] CI runs build, tests, linting

---

## Incident Response

1. **Immediate**: Set `WPNAV_ENABLE_WRITES=0`
2. **Revoke**: Rotate Application Passwords
3. **Restore**: Use plugin's SafetyMiddleware backups
4. **Review**: Check audit logs, improve rate limits

---

**Last Updated**: 2025-12-04
