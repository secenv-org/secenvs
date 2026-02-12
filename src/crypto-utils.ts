import { timingSafeEqual } from "node:crypto"

/**
 * Performs constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
   if (a.length !== b.length) {
      return false
   }
   return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Timing-safe key existence check.
 * Iterates through all keys in a set to ensure constant time regardless of whether the key exists.
 */
export function constantTimeHas(keys: Iterable<string>, target: string): boolean {
   let found = false
   const targetBuffer = Buffer.from(target)

   for (const key of keys) {
      const keyBuffer = Buffer.from(key)
      if (keyBuffer.length === targetBuffer.length) {
         if (timingSafeEqual(keyBuffer, targetBuffer)) {
            found = true
         }
      }
   }
   return found
}
