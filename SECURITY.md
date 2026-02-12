# Security Policy

## Threat Model

Secenv is designed to protect secrets in local development and CI/CD environments. Our security model focuses on mitigating the following risks:

1.  **Malicious npm Dependencies**: Preventing compromised packages from scanning the filesystem for identity keys or accessing the in-memory secret cache via reflection.
2.  **Compromised CI/CD Pipelines**: Ensuring that even if a build environment is partially compromised, secrets remain encrypted at rest and identities are validated.
3.  **Local Privilege Escalation**: Protecting identity keys and encrypted stores with strict file permissions (0600) and preventing symlink attacks that could lead to unauthorized file reads.
4.  **Remote Attackers with Code Execution**: Minimizing timing leaks and ensuring constant-time operations for secret lookups.

_Note: Physical access attacks and kernel-level compromises are out of scope._

## Security Specifications

### 1. Input Validation

- **Keys**: Must strictly match the regex `^[A-Z0-9_]+$`. This prevents shell injection, path traversal, and cross-platform compatibility issues.
- **Reserved Names**: Windows reserved filenames (e.g., `CON`, `PRN`, `NUL`) are prohibited as key names to ensure platform parity and prevent OS-level interference.
- **Value Size Limit**: Maximum 5MB per secret. This prevents Denial of Service (DoS) attacks via disk exhaustion or memory flooding.

### 2. Filesystem Protection

- **Symlink Protection**: Secenv uses `fs.lstatSync` to detect and reject symbolic links for both the identity key and the `.secenv` store. This prevents "symlink race" attacks where an attacker might link a sensitive system file (like `/etc/passwd`) to a location Secenv expects to read.
- **Directory Traversal**: All paths (including `SECENV_HOME`) are resolved and sanitized to ensure they remain within authorized boundaries.
- **Atomic Writes**: Updates to the encrypted store use a "write-sync-rename" pattern (`.tmp` file -> `fsync` -> `rename`). This ensures file integrity even during power failures or process crashes.

### 3. Identity & Encryption

- **File Permissions**: Identity keys are created with `0600` permissions (owner read/write only) on Unix-like systems.
- **AEAD Encryption**: Uses the `age` encryption format, providing Authenticated Encryption with Associated Data. This ensures both confidentiality and integrity (detecting tampering).
- **Nonce Randomness**: Every encryption operation uses a fresh, cryptographically secure nonce, ensuring that the same plaintext results in different ciphertexts.

### 4. SDK Hardening

- **Private Fields**: The `SecenvSDK` uses ECMAScript private fields (`#cache`, `#identity`) which are truly private at runtime. This prevents malicious dependencies from using `Object.keys()`, `JSON.stringify()`, or reflection to steal secrets from memory.
- **Constant-Time Lookups**: `get()` and `has()` operations iterate through all keys in the store and process environment. This mitigates timing attacks that could reveal the existence or length of keys.
- **Zero Leak Policy**: Secrets are never included in error messages, stack traces, or logs.

### 5. Robust Locking

- **Async File Locking**: Prevents race conditions during concurrent writes.
- **Stale Lock Detection**: If a process crashes while holding a lock, Secenv verifies the PID stored in the lock file. If the process no longer exists, the lock is automatically cleared.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please do not open a public issue. Instead, report it to the security team via the contact methods specified in the repository's main README or by contacting the maintainers directly.

We target a 48-hour response time for all security-related inquiries.
