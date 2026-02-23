import { execa } from "execa"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN_PATH = path.resolve(__dirname, "../../bin/secenvs.js")

describe("CLI Audit Logging Integration", () => {
   let testDir: string
   let secenvHome: string

   beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-audit-cli-cwd-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-audit-cli-home-"))
   })

   afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true })
      fs.rmSync(secenvHome, { recursive: true, force: true })
   })

   const run = (args: string[]) => {
      return execa("node", [BIN_PATH, ...args], {
         cwd: testDir,
         env: { SECENV_HOME: secenvHome },
      })
   }

   it("should log INIT action on secenvs init", async () => {
      await run(["init"])
      const { stdout } = await run(["log"])
      expect(stdout).toContain("INIT")
      expect(stdout).toContain("-") // For key field
   })

   it("should log SET and DELETE actions with keys", async () => {
      await run(["init"])
      await run(["set", "MY_SECRET", "super-secret"])
      await run(["delete", "MY_SECRET"])

      const { stdout } = await run(["log"])
      expect(stdout).toContain("SET")
      expect(stdout).toContain("DELETE")
      expect(stdout).toContain("MY_SECRET")
   })

   it("should log TRUST and UNTRUST actions with public keys", async () => {
      const { stdout: initOut } = await run(["init"])
      const pubkeyMatch = initOut.match(/Your public key: (age1[a-z0-9]+)/)
      const ownPubkey = pubkeyMatch![1]

      // Create a fake recipient to trust
      const otherPubkey = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"

      await run(["set", "K", "V"]) // Need at least one secret for re-encryption to kick in and be logged
      await run(["trust", otherPubkey])
      await run(["untrust", otherPubkey])

      const { stdout } = await run(["log"])
      expect(stdout).toContain("TRUST")
      expect(stdout).toContain("UNTRUST")
      expect(stdout).toContain(otherPubkey)
      expect(stdout).toContain("RE-ENCRYPT")
      expect(stdout).toContain("K")
   })

   it("should capture the actor's public key in the log", async () => {
      const { stdout: initOut } = await run(["init"])
      const pubkeyMatch = initOut.match(/Your public key: (age1[a-z0-9]+)/)
      const ownPubkey = pubkeyMatch![1]

      await run(["set", "ACTOR_TEST", "val"])
      const { stdout } = await run(["log"])

      // The actor should be ownPubkey
      expect(stdout).toContain(ownPubkey)
   })

   it("should use 'unknown' when identity key is missing during an operation", async () => {
      await run(["init"])

      // Simulate missing identity key
      const keyPath = path.join(secenvHome, ".secenvs", "keys", "default.key")
      fs.unlinkSync(keyPath)

      // Operation: delete a manually added secret (doesn't require identity for encryption)
      const envPath = path.join(testDir, ".secenvs")
      fs.appendFileSync(envPath, "DELETE_ME=val\n")

      await run(["delete", "DELETE_ME"])
      const { stdout } = await run(["log"])
      expect(stdout).toContain("DELETE")
      expect(stdout).toContain("unknown")
   })

   it("should handle empty audit logs gracefully", async () => {
      await run(["init"])
      // Manually remove audit lines from .secenvs
      const envPath = path.join(testDir, ".secenvs")
      const content = fs.readFileSync(envPath, "utf-8")
      const cleaned = content
         .split("\n")
         .filter((line) => !line.startsWith("_AUDIT="))
         .join("\n")
      fs.writeFileSync(envPath, cleaned)

      const { stdout } = await run(["log"])
      expect(stdout).toContain("No audit log entries found")
   })

   it("should display a formatted table with verification status", async () => {
      await run(["init"])
      await run(["set", "TABLE_TEST", "val"])

      const { stdout } = await run(["log"])
      expect(stdout).toContain("ST | TIMESTAMP")
      expect(stdout).toContain("ACTION")
      expect(stdout).toContain("KEY")
      expect(stdout).toContain("ACTOR")
      expect(stdout).toContain("✅") // Entry should be verified
      expect(stdout).toContain("---")
   })

   it("should display ❌ for tampered audit entries and exit with 1", async () => {
      await run(["init"])
      await run(["set", "T1", "V1"])

      const envPath = path.join(testDir, ".secenvs")
      const content = fs.readFileSync(envPath, "utf-8")
      // Tamper specifically with the SET entry in the audit log
      const tampered = content.replace("|SET|T1|", "|SET|TAMPERED|")
      fs.writeFileSync(envPath, tampered)

      try {
         await run(["log"])
         throw new Error("Should have failed")
      } catch (error: any) {
         expect(error.exitCode).toBe(1)
         expect(error.stdout).toContain("❌")
         expect(error.stdout).toContain("TAMPERED")
         expect(error.stderr).toContain("TAMPERING DETECTED")
      }
   })
})
