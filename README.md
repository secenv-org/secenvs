# secenvs

**Make `.env` secure again. Commit to GitHub without fear.**

secenvs encrypts your environment variables so you can safely commit them to version control. It's `.env` you
can actually share—without the security headaches.

## Why secenvs?

- **Zero wrapper needed** — Import and use secrets directly in your code
- **Lightning fast** — Cold start <50ms, cached access <1ms
- **Battle-tested encryption** — AEAD encryption via [age](https://github.com/FiloSottile/age)
- **CI/CD ready** — Works seamlessly with GitHub Actions and other pipelines
- **Defense-first** — Private fields prevent memory-scanning attacks

## Quick Start

```bash
# Install
npm install secenvs

# Initialize (one-time setup)
npx secenvs init

# Add a secret
npx secenvs set API_KEY "your-secret-key"

# Use in code
import { env } from 'secenvs';

const apiKey = await env.API_KEY;
```

## CLI Commands

```bash
secenvs init              # Initialize identity and project
secenvs set KEY VALUE     # Set a secret (encrypted)
secenvs get KEY           # Get a secret (decrypted)
secenvs list              # List all keys
secenvs rotate KEY        # Rotate a secret
secenvs delete KEY        # Delete a secret
secenvs doctor            # Verify setup and encryption
secenvs key export        # Export private key for CI
```

## SDK Usage

### Basic Access

```typescript
import { env } from "secenvs"

const dbUrl = await env.DATABASE_URL
const apiKey = await env.API_KEY
```

### Fallback to process.env

The SDK checks `process.env` first, then falls back to your `.secenvs` file:

```typescript
// In production, set DATABASE_URL in your deployment platform
// Locally, use .secenvs
const dbUrl = await env.DATABASE_URL
```

### Error Handling

```typescript
import { env, SecretNotFoundError } from "secenvs"

try {
   const key = await env.MISSING_KEY
} catch (e) {
   if (e instanceof SecretNotFoundError) {
      console.error("Secret not found in .secenvs")
   }
}
```

### Programmatic API

```typescript
import { createSecenv } from "secenvs"

const sdk = await createSecenv()
await sdk.set("API_KEY", "secret-value")
const value = await sdk.get("API_KEY")
```

## The `.secenvs` File

Store secrets in `.secenvs` in your project root:

```env
# Encrypted values (auto-decrypted)
API_KEY=enc:age:AGE-SECRET-KEY-1XYZ...

# Plaintext values (non-sensitive config)
PORT=3000
NODE_ENV=development
```

Use `--base64` flag for binary values like certificates:

```bash
secenvs set TLS_CERT --base64 < server.crt
```

## CI/CD Integration

### 1. Export your identity

```bash
secenvs key export
```

### 2. Add to CI secrets

Add the output as `SECENV_ENCODED_IDENTITY` in your CI provider (GitHub Secrets, etc.).

### 3. Use in CI

```yaml
# GitHub Actions example
- name: Run app
  env:
     SECENV_ENCODED_IDENTITY: ${{ secrets.SECENV_ENCODED_IDENTITY }}
  run: npm run start
```

## Security

- **AEAD encryption** — Each secret is encrypted separately with age
- **Private fields** — JavaScript private class fields protect against memory-scanning
- **Constant-time lookups** — Prevents timing attacks
- **Symlink protection** — Blocks symlink attacks

For full security details, see [SECURITY.md](./SECURITY.md).

## Requirements

- Node.js 18+
- No external dependencies (age encryption bundled)

## License

MIT
