import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { env, createEnv } from "../../src/index.ts"
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts"

Deno.test("Deno: env proxy basic access", async () => {
   // Set up a mock environment
   Deno.env.set("DENO_TEST_VAR", "deno_value")

   const value = await env.DENO_TEST_VAR
   assertEquals(value, "deno_value")
})

Deno.test("Deno: createEnv validation", async () => {
   Deno.env.set("PORT", "8080")

   const schema = z.object({
      PORT: z.coerce.number(),
   })

   const config = await createEnv(schema)
   assertEquals(config.PORT, 8080)
})

Deno.test("Deno: SecretNotFoundError handling", async () => {
   await assertRejects(
      async () => {
         await env.NON_EXISTENT_KEY_123
      },
      Error,
      "not found"
   )
})

Deno.test("Deno: env.keys() returns standard env vars", () => {
   Deno.env.set("UNIQUE_DENO_KEY", "mapped")
   const keys = env.keys()
   assertEquals(keys.includes("UNIQUE_DENO_KEY"), true)
})

Deno.test("Deno: Audit Log reading and verification", async () => {
   const tempDir = await Deno.makeTempDir({ prefix: "deno_audit_test" })
   const envPath = `${tempDir}/.secenvs`

   // Fake a valid audit log line (Genesis hash)
   const GENESIS_HASH = "0".repeat(64)
   const ts = "2026-02-23T10:00:00.000Z"
   const data = `${GENESIS_HASH}|${ts}|INIT|-|deno_actor`
   const encoder = new TextEncoder()
   const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data))
   const hashArray = Array.from(new Uint8Array(hashBuffer))
   const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

   const auditLine = `_AUDIT=${hashHex}|${ts}|INIT|-|deno_actor`
   await Deno.writeTextFile(envPath, auditLine + "\n")

   const oldCwd = Deno.cwd()
   Deno.chdir(tempDir)

   try {
      // Import dynamically or from source
      const { readAuditLog } = await import("../../src/audit.ts")
      const logs = readAuditLog()
      assertEquals(logs.length, 1)
      assertEquals(logs[0].verified, true)
      assertEquals(logs[0].action, "INIT")
   } finally {
      Deno.chdir(oldCwd)
      await Deno.remove(tempDir, { recursive: true })
   }
})
