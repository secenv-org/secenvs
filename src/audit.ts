import * as fs from "node:fs"
import * as crypto from "node:crypto"
import { AUDIT_METADATA_KEY, getPublicKey, identityExists, loadIdentity } from "./age.js"
import { safeReadFile } from "./filesystem.js"
import { getEnvPath, withLock, writeAtomicRaw } from "./parse.js"

export interface AuditEntry {
   hash: string
   timestamp: string
   action: string
   key: string
   actor: string
   verified?: boolean
}

const GENESIS_HASH = "0".repeat(64)

function computeHash(
   prevHash: string,
   timestamp: string,
   action: string,
   key: string,
   actor: string
): string {
   const data = `${prevHash}|${timestamp}|${action}|${key}|${actor}`
   return crypto.createHash("sha256").update(data).digest("hex")
}

/**
 * Appends an audit log entry to a .secenvs file with a cryptographic hash chain link.
 */
export async function appendAuditLog(action: string, key: string = "-", filePath?: string): Promise<void> {
   const envPath = filePath || getEnvPath()
   // If it's the global vault or a non-standard file, use a sidecar audit file to avoid corrupting binary data
   const auditFilePath = filePath && !filePath.endsWith(".secenvs") ? `${envPath}.audit` : envPath

   if (!fs.existsSync(envPath) && !filePath) return

   let actor = "unknown"
   if (identityExists()) {
      try {
         const identity = await loadIdentity()
         actor = await getPublicKey(identity)
      } catch {
         // Fallback to unknown if identity is corrupted
      }
   }

   const timestamp = new Date().toISOString()

   await withLock(auditFilePath, async () => {
      const existingEntries = readAuditLog(filePath)
      const prevHash =
         existingEntries.length > 0 ? existingEntries[existingEntries.length - 1].hash : GENESIS_HASH
      const hash = computeHash(prevHash, timestamp, action, key, actor)
      const entryString = `${hash}|${timestamp}|${action}|${key}|${actor}`

      const content = fs.existsSync(auditFilePath) ? safeReadFile(auditFilePath) : ""
      const finalContent =
         content.endsWith("\n") || content === ""
            ? `${content}${AUDIT_METADATA_KEY}=${entryString}\n`
            : `${content}\n${AUDIT_METADATA_KEY}=${entryString}\n`

      await writeAtomicRaw(auditFilePath, finalContent)
   })
}

/**
 * Reads all audit log entries from the .secenvs file and verifies the hash chain.
 */
export function readAuditLog(filePath?: string): AuditEntry[] {
   const envPath = filePath || getEnvPath()
   const auditFilePath = filePath && !filePath.endsWith(".secenvs") ? `${envPath}.audit` : envPath

   if (!fs.existsSync(auditFilePath)) return []

   const content = safeReadFile(auditFilePath)
   const lines = content.split("\n")
   const entries: AuditEntry[] = []

   for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`${AUDIT_METADATA_KEY}=`)) {
         const value = trimmed.slice(AUDIT_METADATA_KEY.length + 1)
         const [hash, timestamp, action, key, actor] = value.split("|")
         if (hash && timestamp && action && key && actor) {
            entries.push({ hash, timestamp, action, key, actor })
         }
      }
   }

   // Verify the chain
   let currentPrevHash = GENESIS_HASH
   for (const entry of entries) {
      const expectedHash = computeHash(currentPrevHash, entry.timestamp, entry.action, entry.key, entry.actor)
      entry.verified = entry.hash === expectedHash
      currentPrevHash = entry.hash
   }

   return entries
}
