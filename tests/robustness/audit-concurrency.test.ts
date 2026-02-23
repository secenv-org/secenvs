import { execa } from "execa"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BIN_PATH = path.resolve(__dirname, "../../bin/secenvs")

describe("Audit Log Robustness: Concurrency", () => {
   let testDir: string
   let secenvHome: string

   beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-audit-stress-cwd-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenv-audit-stress-home-"))
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

   it("should handle 10 concurrent secret sets without losing audit entries", async () => {
      await run(["init"])

      const count = 10
      const tasks = []
      for (let i = 0; i < count; i++) {
         tasks.push(run(["set", `KEY_${i}`, `VAL_${i}`]))
      }

      await Promise.all(tasks)

      const { stdout } = await run(["log"])

      // We expect 1 (init) + 10 (sets) = 11 entries
      // Note: The log command might not show 11 if some entries are collapsed or if testing is slow,
      // but we can check the raw .secenvs file for _AUDIT lines.
      const content = fs.readFileSync(path.join(testDir, ".secenvs"), "utf-8")
      const auditLines = content.split("\n").filter((l) => l.startsWith("_AUDIT="))

      expect(auditLines.length).toBe(11) // 1 for init, 10 for sets
   })

   it("should handle mixed operations (set/delete/trust) concurrently", async () => {
      await run(["init"])

      // Setup some initial keys
      await run(["set", "K1", "V1"])
      await run(["set", "K2", "V2"])

      const tasks = [
         run(["set", "K3", "V3"]),
         run(["delete", "K1"]),
         run(["set", "K4", "V4"]),
         run(["delete", "K2"]),
         run(["set", "K5", "V5"]),
      ]

      await Promise.all(tasks)

      const content = fs.readFileSync(path.join(testDir, ".secenvs"), "utf-8")
      const auditLines = content.split("\n").filter((l) => l.startsWith("_AUDIT="))

      // init + 2 (setup) + 5 (tasks) = 8
      expect(auditLines.length).toBe(8)
   })
})
