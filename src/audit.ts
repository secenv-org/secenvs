import * as fs from "node:fs"
import { AUDIT_METADATA_KEY, getPublicKey, identityExists, loadIdentity } from "./age.js"
import { safeReadFile } from "./filesystem.js"
import { getEnvPath, withLock, writeAtomicRaw } from "./parse.js"

export interface AuditEntry {
   timestamp: string
   action: string
   key: string
   actor: string
}

/**
 * Appends an audit log entry to the .secenvs file.
 */
export async function appendAuditLog(action: string, key: string = "-"): Promise<void> {
   const envPath = getEnvPath()
   if (!fs.existsSync(envPath)) return

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
   const entry = `${timestamp}|${action}|${key}|${actor}`

   await withLock(envPath, async () => {
      const content = fs.existsSync(envPath) ? safeReadFile(envPath) : ""
      const finalContent =
         content.endsWith("\n") || content === ""
            ? `${content}${AUDIT_METADATA_KEY}=${entry}\n`
            : `${content}\n${AUDIT_METADATA_KEY}=${entry}\n`

      await writeAtomicRaw(envPath, finalContent)
   })
}

/**
 * Reads all audit log entries from the .secenvs file.
 */
export function readAuditLog(): AuditEntry[] {
   const envPath = getEnvPath()
   if (!fs.existsSync(envPath)) return []

   const content = safeReadFile(envPath)
   const lines = content.split("\n")
   const entries: AuditEntry[] = []

   for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`${AUDIT_METADATA_KEY}=`)) {
         const value = trimmed.slice(AUDIT_METADATA_KEY.length + 1)
         const [timestamp, action, key, actor] = value.split("|")
         if (timestamp && action && key && actor) {
            entries.push({ timestamp, action, key, actor })
         }
      }
   }

   return entries
}
