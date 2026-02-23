# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.2.0] - 2026-02-23

### Added

- **Cryptographic Audit Log**: Every state-changing CLI operation is now recorded in a cryptographically
  auditable log within the `.secenvs` file.
- **Deno Support**: Full compatibility with Deno via `npm:secenvs` and `node:` prefixed imports.
- **Multi-Recipient Support**: Alice and Bob can now share a `.secenvs` file and decrypt with their own unique
  keys.
- **Global Vault Integration**: Store shared secrets in `~/.secenvs/vault.age` and reference them with
  `vault:KEY`.
- **Migration Engine**: `secenvs migrate` converts legacy `.env` files interactively.
- **Polyglot Runner**: `secenvs run -- <command>` injects secrets into any subprocess (Python, Go, etc.).
- **Git Hooks**: Native pre-commit hooks to block accidental `.env` commits.
- **Zod Integration**: `createEnv` wrapper for runtime schema validation.
- **Improved Polyglot Documentation**: Promoted `secenvs run` as the strongest multi-language story.

### Changed

- Standardized all internal imports to use the `node:` prefix for better cross-runtime compatibility.
- Repositioned as a "secret management layer" focused on governance and trust.
- Migrated test framework compilation from `ts-jest` to `@swc/jest`, reducing test suite execution times by
  over 45%.

### Fixed

- Filtered out internal metadata keys (like `_AUDIT` and `_RECIPIENT`) from `secenvs export` output.
- Resolved various flaky test environments spanning raw binary invocations and ANSI shell coloring edge cases.

## [0.1.5] - 2026-02-16

### Added

- **Comprehensive Test Suite**: Added 100+ tests covering user blunders, concurrent access, and recovery
  workflows.
- **Enhanced Validation**: Strict validation for keys and values at the CLI level.
- **Robustness Improvements**: Better error handling and edge-case coverage.

## [0.1.4] - 2026-02-15

### Fixed

- Renamed bin script to `.js` to resolve npm publish warnings.

## [0.1.3] - 2026-02-14

### Changed

- Updated README with better feature descriptions and clarifications.

## [0.1.0] - 2026-02-12

### Added

- Initial release with core encryption and SDK.
- Support for `secenvs set`, `get`, `list`, `rotate`.
- Standard `.secenvs` file format.
