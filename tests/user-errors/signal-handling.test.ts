import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { fileURLToPath } from "url"
import { spawn } from "child_process"
import { setTimeout } from "timers/promises"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN_PATH = path.resolve(__dirname, "../../bin/secenvs")

describe("Signal Handling", () => {
   let testDir: string
   let secenvHome: string

   beforeEach(async () => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-signal-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-signal-home-"))

      // Initialize
      const init = spawn("node", [BIN_PATH, "init"], {
         cwd: testDir,
         env: { ...process.env, SECENV_HOME: secenvHome },
      })

      await new Promise((resolve) => init.on("close", resolve))
   })

   afterEach(() => {
      try {
         fs.rmSync(testDir, { recursive: true, force: true })
      } catch (e) {}
      try {
         fs.rmSync(secenvHome, { recursive: true, force: true })
      } catch (e) {}
   })

   describe("SIGINT (Ctrl+C) handling", () => {
      it("should cleanup on SIGINT during set operation", async () => {
         const envPath = path.join(testDir, ".secenvs")
         fs.writeFileSync(envPath, "EXISTING=value\n")

         // Start a set operation
         const proc = spawn("node", [BIN_PATH, "set", "NEW", "newvalue"], {
            cwd: testDir,
            env: { ...process.env, SECENV_HOME: secenvHome },
         })

         // Wait a bit then send SIGINT
         await setTimeout(100)
         proc.kill("SIGINT")

         // Wait for process to exit
         const exitCode = await new Promise((resolve) => proc.on("close", resolve))

         // Original file should be intact
         const content = fs.readFileSync(envPath, "utf-8")
         expect(content).toContain("EXISTING=value")
      })

      it("should cleanup on SIGINT during interactive prompt", async () => {
         // Start interactive set
         const proc = spawn("node", [BIN_PATH, "set", "KEY"], {
            cwd: testDir,
            env: { ...process.env, SECENV_HOME: secenvHome },
         })

         // Send SIGINT quickly
         await setTimeout(50)
         proc.kill("SIGINT")

         const exitCode = await new Promise((resolve) => proc.on("close", resolve))

         // Should exit non-zero
         expect(exitCode).not.toBe(0)
      })
   })

   describe("SIGTERM handling", () => {
      it("should handle SIGTERM gracefully during write", async () => {
         const envPath = path.join(testDir, ".secenvs")

         // Start multiple rapid writes
         const processes: ReturnType<typeof spawn>[] = []
         for (let i = 0; i < 3; i++) {
            const proc = spawn("node", [BIN_PATH, "set", `KEY${i}`, `value${i}`], {
               cwd: testDir,
               env: { ...process.env, SECENV_HOME: secenvHome },
            })
            processes.push(proc)
         }

         // Send SIGTERM to all
         await setTimeout(50)
         processes.forEach((p) => p.kill("SIGTERM"))

         // Wait for all to exit
         await Promise.all(processes.map((p) => new Promise((resolve) => p.on("close", resolve))))

         // File should still be valid or empty, not corrupted
         if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, "utf-8")
            // Should not contain partial writes
            expect(content.split("=").length).toBeLessThanOrEqual(20)
         }
      })
   })

   describe("Rapid signal storms", () => {
      it("should handle multiple rapid SIGINT signals", async () => {
         const proc = spawn("node", [BIN_PATH, "export"], {
            cwd: testDir,
            env: { ...process.env, SECENV_HOME: secenvHome },
         })

         // Send multiple SIGINT rapidly
         for (let i = 0; i < 5; i++) {
            await setTimeout(10)
            proc.kill("SIGINT")
         }

         const exitCode = await new Promise((resolve) => proc.on("close", resolve))
         expect(exitCode).not.toBe(0)
      })
   })

   describe("Cleanup verification", () => {
      it("should not leave temp files after signal", async () => {
         const proc = spawn("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { ...process.env, SECENV_HOME: secenvHome },
         })

         await setTimeout(100)
         proc.kill("SIGTERM")

         await new Promise((resolve) => proc.on("close", resolve))

         // Check for temp files
         const files = fs.readdirSync(testDir)
         const tempFiles = files.filter((f) => f.includes(".tmp") || f.includes("~"))

         expect(tempFiles).toHaveLength(0)
      })

      it("should release locks after signal", async () => {
         const lockPath = path.join(testDir, ".secenvs.lock")

         const proc = spawn("node", [BIN_PATH, "set", "KEY", "value"], {
            cwd: testDir,
            env: { ...process.env, SECENV_HOME: secenvHome },
         })

         await setTimeout(100)
         proc.kill("SIGINT")

         await new Promise((resolve) => proc.on("close", resolve))

         // Lock file should be released (removed or stale)
         if (fs.existsSync(lockPath)) {
            // If lock exists, process should not be running
            const pid = parseInt(fs.readFileSync(lockPath, "utf-8"))
            expect(isNaN(pid) || pid !== proc.pid).toBe(true)
         }
      })
   })
})
