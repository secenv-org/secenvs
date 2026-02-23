import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { appendAuditLog, readAuditLog } from "../../src/audit.js"
import { AUDIT_METADATA_KEY } from "../../src/age.js"

describe("Audit Log Cryptographic Chain (audit.ts)", () => {
   let testDir: string
   let originalCwd: string
   let originalEnvHome: string | undefined

   beforeEach(() => {
      originalCwd = process.cwd()
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-audit-unit-"))
      process.chdir(testDir)

      originalEnvHome = process.env.SECENV_HOME
      process.env.SECENV_HOME = testDir
   })

   afterEach(() => {
      process.chdir(originalCwd)
      fs.rmSync(testDir, { recursive: true, force: true })
      process.env.SECENV_HOME = originalEnvHome
   })

   it("should maintain a valid hash chain across multiple entries", async () => {
      fs.writeFileSync(".secenvs", "")
      
      await appendAuditLog("INIT")
      await appendAuditLog("SET", "KEY1")
      await appendAuditLog("DELETE", "KEY1")

      const logs = readAuditLog()
      expect(logs).toHaveLength(3)
      expect(logs[0].verified).toBe(true)
      expect(logs[1].verified).toBe(true)
      expect(logs[2].verified).toBe(true)
      
      // Check that hashes are different
      expect(logs[0].hash).not.toBe(logs[1].hash)
      expect(logs[1].hash).not.toBe(logs[2].hash)
   })

   it("should detect tampering if an entry is modified", async () => {
      fs.writeFileSync(".secenvs", "")
      await appendAuditLog("INIT")
      await appendAuditLog("SET", "SENSITIVE_KEY")

      const content = fs.readFileSync(".secenvs", "utf-8")
      // Tamper with the second entry's action
      const tampered = content.replace("SET", "GET")
      fs.writeFileSync(".secenvs", tampered)

      const logs = readAuditLog()
      expect(logs[0].verified).toBe(true)
      expect(logs[1].verified).toBe(false) // Tampered!
   })

   it("should detect tampering if an entry is deleted from the middle", async () => {
      fs.writeFileSync(".secenvs", "")
      await appendAuditLog("ENTRY1")
      await appendAuditLog("ENTRY2")
      await appendAuditLog("ENTRY3")

      const content = fs.readFileSync(".secenvs", "utf-8")
      const lines = content.split("\n")
      // Remove ENTRY2 (line 2 assuming no other content)
      const tamperedLines = lines.filter(l => !l.includes("ENTRY2"))
      fs.writeFileSync(".secenvs", tamperedLines.join("\n"))

      const logs = readAuditLog()
      expect(logs).toHaveLength(2)
      expect(logs[0].action).toBe("ENTRY1")
      expect(logs[0].verified).toBe(true)
      expect(logs[1].action).toBe("ENTRY3")
      expect(logs[1].verified).toBe(false) // Chain broken!
   })

   it("should read correctly even with non-audit metadata present", async () => {
      fs.writeFileSync(".secenvs", "_RECIPIENT=age1abc\n")
      await appendAuditLog("SET", "K")
      
      const logs = readAuditLog()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe("SET")
      expect(logs[0].verified).toBe(true)
   })

   it("should handle the 'unknown' actor gracefully", async () => {
      fs.writeFileSync(".secenvs", "")
      await appendAuditLog("ACTION", "KEY")
      
      const logs = readAuditLog()
      expect(logs[0].actor).toBe("unknown")
      expect(logs[0].verified).toBe(true)
   })
})
