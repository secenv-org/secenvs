import { ValidationError } from './errors.js';

const KEY_REGEX = /^[A-Z0-9_]+$/;
const MAX_VALUE_SIZE = 5 * 1024 * 1024; // 5MB

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

export function validateKey(key: string): void {
  if (!key) {
    throw new ValidationError('Key cannot be empty');
  }
  if (!KEY_REGEX.test(key)) {
    throw new ValidationError(`Invalid key: '${key}'. Keys must only contain uppercase letters, numbers, and underscores (^[A-Z0-9_]+$).`);
  }
  if (WINDOWS_RESERVED_NAMES.has(key)) {
    throw new ValidationError(`Invalid key: '${key}' is a reserved system name.`);
  }
}

export function validateValue(value: string): void {
  if (Buffer.byteLength(value, 'utf-8') > MAX_VALUE_SIZE) {
    throw new ValidationError(`Value size exceeds maximum limit of 5MB`);
  }
}
