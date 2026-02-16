import { execa } from "execa"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { fileURLToPath } from "url"
import { createSecenv } from "../../src/env.js"
import { generateIdentity, saveIdentity, encrypt } from "../../src/age.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN_PATH = path.resolve(__dirname, "../../bin/secenvs")

describe("Recovery Workflows: Error → Fix → Success", () => {
   let testDir: string
   let secenvHome: string

   let originalCwd: string

   beforeEach(async () => {
      originalCwd = process.cwd()
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-recovery-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-recovery-home-"))
      process.env.SECENV_HOME = secenvHome
      process.chdir(testDir)

      const identity = await generateIdentity()
      await saveIdentity(identity)
   })

   afterEach(() => {
      process.chdir(originalCwd)
      delete process.env.SECENV_HOME
      try {
         fs.rmSync(testDir, { recursive: true, force: true })
      } catch (e) {}
      try {
         fs.rmSync(secenvHome, { recursive: true, force: true })
      } catch (e) {}
   })

   describe("Identity Recovery", () => {
      it("should recover after deleting and recreating identity", async () => {
         // User accidentally deletes identity
         const keyPath = path.join(secenvHome, ".secenvs", "keys", "default.key")
         fs.unlinkSync(keyPath)

         // Should fail without identity
         const { exitCode } = await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
            reject: false,
         })
         expect(exitCode).toBe(1)

         // User recreates identity with init
         await execa("node", [BIN_PATH, "init"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // Should work now
         const result = await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(result.exitCode).toBe(0)
      })

      it("should recover after corrupting .secenvs file", async () => {
         // Create valid file
         await execa("node", [BIN_PATH, "set", "KEY1", "value1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // User corrupts file manually
         fs.writeFileSync(path.join(testDir, ".secenvs"), "INVALID_LINE\n")

         // Should fail
         const { exitCode } = await execa("node", [BIN_PATH, "get", "KEY1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
            reject: false,
         })
         expect(exitCode).toBe(1)

         // User fixes file
         fs.writeFileSync(path.join(testDir, ".secenvs"), "KEY1=fixedvalue\n")

         // Should work now
         const { stdout } = await execa("node", [BIN_PATH, "get", "KEY1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(stdout).toBe("fixedvalue")
      })
   })

   describe("Permission Recovery", () => {
      it("should work after fixing wrong permissions on identity file", async () => {
         if (os.platform() === "win32") return

         // Set wrong permissions
         const keyPath = path.join(secenvHome, ".secenvs", "keys", "default.key")
         fs.chmodSync(keyPath, 0o644)

         // Doctor should warn
         const { stdout } = await execa("node", [BIN_PATH, "doctor"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(stdout).toContain("permissions")

         // User fixes permissions
         fs.chmodSync(keyPath, 0o600)

         // Doctor should pass
         const { stdout: fixedStdout } = await execa("node", [BIN_PATH, "doctor"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(fixedStdout).not.toContain("permissions should be")
      })
   })

   describe("Environment Recovery", () => {
      it("should recover after wrong SECENV_HOME", async () => {
         // User sets wrong SECENV_HOME
         const wrongHome = path.join(os.tmpdir(), "wrong-secenv-home")
         fs.mkdirSync(wrongHome, { recursive: true })

         // Should fail (no identity in wrong home)
         const { exitCode } = await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: wrongHome },
            reject: false,
         })
         expect(exitCode).toBe(1)

         // User fixes SECENV_HOME
         const result = await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(result.exitCode).toBe(0)

         fs.rmSync(wrongHome, { recursive: true, force: true })
      })

      it("should recover after CWD change", async () => {
         // Set value in current dir
         await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         const sdk = createSecenv()
         expect(await sdk.get("KEY")).toBe("value")

         // Change to different dir
         const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-other-"))
         fs.writeFileSync(path.join(otherDir, ".secenvs"), "OTHER=value\n")
         process.chdir(otherDir)

         // SDK should auto-detect path change and find new value
         expect(await sdk.get("OTHER")).toBe("value")

         // Cleanup - chdir back to testDir so afterEach can clean up properly
         process.chdir(testDir)
         fs.rmSync(otherDir, { recursive: true, force: true })
      })
   })

   describe("Lock Recovery", () => {
      it("should recover after stale lock file", async () => {
         // Create stale lock
         const lockPath = path.join(testDir, ".secenvs.lock")
         fs.writeFileSync(lockPath, "99999")

         // Should still work (removes stale lock)
         await execa("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // Lock should be gone
         expect(fs.existsSync(lockPath)).toBe(false)
      })
   })

   describe("Data Recovery", () => {
      it("should recover deleted key from backup workflow", async () => {
         // Set multiple keys
         await execa("node", [BIN_PATH, "set", "KEY1", "value1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         await execa("node", [BIN_PATH, "set", "KEY2", "value2"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // User accidentally deletes KEY1
         await execa("node", [BIN_PATH, "delete", "KEY1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // Verify it's gone
         const { exitCode } = await execa("node", [BIN_PATH, "get", "KEY1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
            reject: false,
         })
         expect(exitCode).toBe(1)

         // User recreates it
         await execa("node", [BIN_PATH, "set", "KEY1", "newvalue"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })

         // Should work
         const { stdout } = await execa("node", [BIN_PATH, "get", "KEY1"], {
            cwd: testDir,
            env: { SECENV_HOME: secenvHome },
         })
         expect(stdout).toBe("newvalue")
      })
   })
})
