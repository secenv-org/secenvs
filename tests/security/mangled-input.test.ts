import { execa } from "execa"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const BIN_PATH = path.resolve(process.env.SECENV_ORIGINAL_CWD || process.cwd(), "bin/secenvs")

describe("Mangled Input Fuzzing", () => {
   let testDir: string
   let secenvHome: string

   beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "secenvs-fuzz-"))
      secenvHome = fs.mkdtempSync(path.join(os.tmpdir(), "secenvs-home-fuzz-"))
   })

   afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true })
      fs.rmSync(secenvHome, { recursive: true, force: true })
   })

   const runCLI = (args: string[]) => {
      return execa("node", [BIN_PATH, ...args], {
         cwd: testDir,
         env: { SECENV_HOME: secenvHome },
      })
   }

   it("should handle files with no '=' separator", async () => {
      fs.writeFileSync(path.join(testDir, ".secenvs"), "THIS IS INVALID CONTENT\n")
      try {
         await runCLI(["list"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Invalid line: missing '=' separator")
      }
   })

   it("should handle files with empty keys", async () => {
      fs.writeFileSync(path.join(testDir, ".secenvs"), "=value\n")
      try {
         await runCLI(["list"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Invalid line: missing key before '='")
      }
   })

   it("should handle duplicate keys with a ParseError", async () => {
      fs.writeFileSync(path.join(testDir, ".secenvs"), "K1=V1\nK1=V2\n")
      try {
         await runCLI(["list"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Duplicate key 'K1'")
      }
   })

   it("should handle garbage binary input", async () => {
      // Write some random bytes
      const bytes = Buffer.from([0xFF, 0xFE, 0xFD, 0x00, 0x01, 0x02])
      fs.writeFileSync(path.join(testDir, ".secenvs"), bytes)
      try {
         await runCLI(["list"])
         fail("Should have failed")
      } catch (e: any) {
         // Should fail due to lack of '=' or invalid format
         expect(e.stderr).toBeTruthy()
      }
   })

   it("should handle partial/truncated age blobs", async () => {
      await runCLI(["init"])
      await runCLI(["set", "K", "V"])
      let content = fs.readFileSync(path.join(testDir, ".secenvs"), "utf-8")
      // Truncate the blob
      content = content.substring(0, content.length - 10)
      fs.writeFileSync(path.join(testDir, ".secenvs"), content)

      try {
         await runCLI(["get", "K"])
         fail("Should have failed")
      } catch (e: any) {
         expect(e.stderr).toContain("Failed to decrypt")
      }
   })
})
