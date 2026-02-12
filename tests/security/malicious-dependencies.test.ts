import { createSecenv } from '../../src/env.js';

describe('Malicious Dependency Defense', () => {
  it('should not allow access to private cache', () => {
    const env = createSecenv();
    // In JavaScript, private fields starting with # are truly private and 
    // throw a SyntaxError if accessed from outside the class.
    // We can't even test this with 'expect().toThrow()' because it's a compile-time/syntax error.
    // But we can check if it's visible in Object.keys or other reflection methods.
    
    expect(Object.keys(env)).not.toContain('cache');
    expect(Object.getOwnPropertyNames(env)).not.toContain('cache');
    expect(Object.getOwnPropertySymbols(env)).toHaveLength(0);
  });

  it('should not leak identity via reflection', () => {
    const env = createSecenv();
    expect(Object.keys(env)).not.toContain('identity');
  });
});
