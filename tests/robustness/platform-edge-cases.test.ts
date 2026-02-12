import { validateKey } from '../../src/validators.js';
import { ValidationError } from '../../src/errors.js';

describe('Platform Edge Cases', () => {
  it('should reject Windows reserved names', () => {
    expect(() => validateKey('CON')).toThrow(ValidationError);
    expect(() => validateKey('PRN')).toThrow(ValidationError);
    expect(() => validateKey('AUX')).toThrow(ValidationError);
    expect(() => validateKey('NUL')).toThrow(ValidationError);
    expect(() => validateKey('COM1')).toThrow(ValidationError);
    expect(() => validateKey('LPT9')).toThrow(ValidationError);
  });

  it('should accept valid non-reserved names', () => {
    expect(() => validateKey('CONFIG')).not.toThrow();
    expect(() => validateKey('PRINTER')).not.toThrow();
    expect(() => validateKey('NORMAL_KEY')).not.toThrow();
  });
});
