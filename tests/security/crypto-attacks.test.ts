import { constantTimeEqual, constantTimeHas } from '../../src/crypto-utils.js';
import { timingSafeEqual } from 'node:crypto';

// We can't easily test the actual timing in Jest, 
// but we can verify the logic.

describe('Crypto Attack Mitigation', () => {
  it('constantTimeEqual should return true for equal strings', () => {
    expect(constantTimeEqual('SECRET', 'SECRET')).toBe(true);
  });

  it('constantTimeEqual should return false for unequal strings', () => {
    expect(constantTimeEqual('SECRET', 'WRONG')).toBe(false);
    expect(constantTimeEqual('SECRET', 'SECREX')).toBe(false);
  });

  it('constantTimeHas should find existing key', () => {
    const keys = ['KEY1', 'KEY2', 'KEY3'];
    expect(constantTimeHas(keys, 'KEY2')).toBe(true);
  });

  it('constantTimeHas should not find non-existing key', () => {
    const keys = ['KEY1', 'KEY2', 'KEY3'];
    expect(constantTimeHas(keys, 'KEY4')).toBe(false);
  });

  // Note: To truly verify constant time, we would need to instrument the code 
  // to ensure it doesn't short-circuit. 
  // In our implementation of constantTimeHas:
  // for (const key of keys) { ... if (timingSafeEqual(...)) { found = true; } }
  // It does NOT break/return early.
});
