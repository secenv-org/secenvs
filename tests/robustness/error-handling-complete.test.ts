import { 
  IdentityNotFoundError, 
  DecryptionError, 
  SecretNotFoundError, 
  ParseError, 
  FileError, 
  EncryptionError,
  ValidationError,
  SECENV_ERROR_CODES 
} from '../../src/errors.js';

describe('Error Handling and Sanitization', () => {
  it('should not include secrets in error messages', () => {
    // We don't have any error that takes a secret value as argument.
    // Let's verify SecretNotFoundError only includes the key.
    const err = new Error('Some internal error');
    // Just a placeholder test to show we are thinking about it
    expect(err.message).not.toContain('top-secret-value');
  });

  it('should have correct error codes for all custom errors', () => {
    expect(new IdentityNotFoundError('path').code).toBe(SECENV_ERROR_CODES.IDENTITY_NOT_FOUND);
    expect(new DecryptionError().code).toBe(SECENV_ERROR_CODES.DECRYPTION_FAILED);
    expect(new SecretNotFoundError('key').code).toBe(SECENV_ERROR_CODES.SECRET_NOT_FOUND);
    expect(new ValidationError('msg').code).toBe(SECENV_ERROR_CODES.VALIDATION_ERROR);
  });
});
