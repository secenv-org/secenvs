import { execa } from "execa"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const BIN_PATH = path.resolve(process.env.SECENV_ORIGINAL_CWD || process.cwd(), "bin/secenvs")

describe("Filesystem Chaos", () => {
   let testDir: string
   let secenvHome: string

   beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenvs-chaos-fs-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenvs-home-fs-"))
   })

   afterEach(() => {
      // Restore permissions before deletion just in case
      try {
         fs.chmodSync(testDir, 0o777)
      } catch {}
      fs.rmSync(testDir, { recursive: true, force: true })
      fs.rmSync(secenvHome, { recursive: true, force: true })
   })

   const runCLI = (args: string[]) => {
      return execa("node", [BIN_PATH, ...args], {
         cwd: testDir,
         env: { SECENV_HOME: secenvHome },
      })
   }

   it("should fail gracefully when .secenvs is unwritable", async () => {
      await runCLI(["init"])
      const secenvsPath = path.join(testDir, ".secenvs")
      fs.chmodSync(secenvsPath, 0o444) // Read only

      try {
         await runCLI(["set", "K", "V"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("EACCES")
         expect(e.stderr).toContain("Failed to write")
      }
   })

   it("should reject symlinks for .secenvs (Security Policy)", async () => {
      const realFile = path.join(os.tmpdir(), "real-secrets")
      fs.writeFileSync(realFile, "K=V\n")
      const symlinkPath = path.join(testDir, ".secenvs")
      fs.symlinkSync(realFile, symlinkPath)

      try {
         await runCLI(["get", "K"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Symlink detected")
      } finally {
         fs.unlinkSync(realFile)
      }
   })

   it("should handle missing SECENV_HOME gracefully", async () => {
      const result = await execa("node", [BIN_PATH, "init"], {
         cwd: testDir,
         env: { SECENV_HOME: "/non/existent/path/that/cannot/be/created" },
      }).catch((e) => e)

      expect(result.stderr).toContain("Failed to ensure safe directory")
   })

   it("should handle lock file permission errors", async () => {
      await runCLI(["init"])
      const lockPath = path.join(testDir, ".secenvs.lock")
      // Create a directory where the lock file should be, to cause EEXIST or similar
      // or just make the directory unwritable
      fs.chmodSync(testDir, 0o555) // Read and execute only

      try {
         await runCLI(["set", "K", "V"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Failed to acquire lock")
      }
   })
})
