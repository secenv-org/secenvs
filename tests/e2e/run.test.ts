import { execSync } from "child_process"
import * as path from "path"
import * as fs from "fs"
import * as os from "os"

const CLI_PATH = path.resolve(process.cwd(), "bin/secenvs.js")

describe("E2E: Polyglot Support (secenvs run)", () => {
   let tempDir: string
   let originalCwd: string
   let originalEnv: NodeJS.ProcessEnv

   beforeEach(() => {
      originalCwd = process.cwd()
      originalEnv = { ...process.env }
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenvs-e2e-run-"))
      process.chdir(tempDir)

      // Isolate SECENV_HOME
      process.env.SECENV_HOME = tempDir

      // Initialize workspace
      execSync(`node ${CLI_PATH} init`, { stdio: "ignore" })
   })

   afterEach(() => {
      process.chdir(originalCwd)
      process.env = originalEnv
      fs.rmSync(tempDir, { recursive: true, force: true })
   })

   it("injects decrypted secrets into child process via --", () => {
      // 1. Set a secret
      execSync(`node ${CLI_PATH} set SECRET_DB_PASS supersecret123`, { stdio: "ignore" })

      // 2. Set an unencrypted standard variable
      fs.appendFileSync(".secenvs", "PUBLIC_VAR=public_info\n")

      // 3. Run a polyglot test command (using node to mock)
      const output = execSync(
         `node ${CLI_PATH} run -- node -e "console.log(process.env.SECRET_DB_PASS + '|' + process.env.PUBLIC_VAR)"`,
         {
            encoding: "utf-8",
         }
      )

      expect(output.trim()).toBe("supersecret123|public_info")
   })

   it("throws an error if -- separator is missing", () => {
      expect(() => {
         execSync(`node ${CLI_PATH} run echo hello`, { stdio: "pipe" })
      }).toThrow(/Usage: secenvs run --/)
   })

   it("exits with the same code as the child process", () => {
      let exitCode = 0
      try {
         // This child process exits with code 42
         execSync(`node ${CLI_PATH} run -- node -e "process.exit(42)"`, { stdio: "ignore" })
      } catch (error: any) {
         exitCode = error.status
      }
      expect(exitCode).toBe(42)
   })
})
