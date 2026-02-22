# How It Works: Under the Hood

`secenvs` is built on top of the [age-encryption](https://github.com/FiloSottile/age) protocol. This document
outlines the technical architecture and the lifecycle of a secret.

## The Identity

When you run `secenvs init`, the tool generates an **X25519 key pair**:

- **Private Key (Identity):** Stored in `~/.secenvs/keys/default.key`. This is your "skeleton key." It stays
  on your machine and must never be shared.
- **Public Key (Recipient):** Used by others to encrypt secrets for you. You can find this by running
  `secenvs key export`.

## The Secret Lifecycle

### 1. Encryption

When you run `secenvs set API_KEY "secret123"`:

1. The CLI reads `.secenvs.recipients` to get the list of authorized public keys.
2. It generates a random file key.
3. It encrypts the plaintext `"secret123"` using the `age` format, wrapping it for **all** authorized public
   keys simultaneously.
4. It prefixes the result with `enc:age:` and saves it to your `.secenvs` file.

### 2. Resolution (Runtime)

When your application calls `const key = await env.API_KEY`:

1. The SDK checks if the value in `.secenvs` starts with `enc:age:`.
2. It retrieves your private key from `~/.secenvs/keys/default.key` (or the `SECENV_ENCODED_IDENTITY`
   environment variable in CI).
3. It performs a high-performance decryption in-memory.
4. The result is cached for the lifetime of the process to ensure subsequent access is lightning fast (<1ms).

## The Global Vault

The **Global Vault** (`~/.secenvs/vault.age`) works exactly like a project-level `.secenvs` file, but with two
key differences:

1. **Scope:** It is stored in your user home directory, making its secrets accessible across all your
   projects.
2. **Access:** It is encrypted **only for you**. It is intended for your personal shared secrets (like a
   personal AWS sandbox key), not for team-shared project secrets.

## Performance & Security

- **No External Processes:** Encryption/decryption happens within the Node.js process using a bundled library.
- **Private Field Protection:** Resolved secrets are held in JavaScript `#private` class fields, preventing
  them from being serialized or easily leaked via `console.log(sdk)`.
- **Atomic Renames:** File writes use a "write-to-temp-then-rename" pattern to ensure that even if a crash
  occurs during a write, your configuration files are never left in a corrupted state.
