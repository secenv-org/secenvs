# secenv

**The Breeze: Secret management without the overhead.**

Secenv is a secure, local-first secret management tool designed for indie developers. It provides encrypted environment variables with a simple CLI and a powerful TypeScript SDK.

## Features

- 🔐 **Hardened Security**: AEAD encryption via `age`, symlink protection, and constant-time lookups.
- 🚀 **Zero Overhead**: Cold start <50ms, cached access <1ms.
- 🛠️ **Developer Friendly**: Simple CLI (`set`, `get`, `list`, `delete`) and native TypeScript support.
- ☁️ **CI/CD Ready**: Supports `SECENV_ENCODED_IDENTITY` for easy pipeline integration.
- 🛡️ **Malicious Dependency Defense**: True private fields prevent memory-scanning attacks.

## Quick Start

### 1. Install
```bash
npm install secenv
```

### 2. Initialize
```bash
npx secenv init
```

### 3. Set a secret
```bash
npx secenv set API_KEY "your-super-secret-key"
```

### 4. Use in code
```typescript
import { env } from 'secenv';

async function start() {
  const apiKey = await env.API_KEY;
  console.log(`Using API Key: ${apiKey}`);
}
```

## Security

For detailed information on our threat model and security implementation, see [SECURITY.md](./SECURITY.md).

## Documentation

- [Usage Guide](./docs/USAGE_P1.md)
- [Implementation Plan](./docs/PLAN_P1.md)

## License

MIT
