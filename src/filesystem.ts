import * as fs from 'fs';
import * as path from 'path';
import { FileError } from './errors.js';

/**
 * Reads a file while ensuring it's not a symlink to prevent symlink attacks.
 */
export function safeReadFile(filePath: string): string {
  try {
    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      throw new FileError(`Symlink detected at ${filePath}. Security policy prohibits following symlinks.`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error: any) {
    if (error instanceof FileError) throw error;
    throw new FileError(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Sanitizes a path to prevent directory traversal.
 * Ensures the path is within the expected base directory if provided.
 */
export function sanitizePath(filePath: string, baseDir?: string): string {
  const absolutePath = path.resolve(filePath);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.lstatSync(filePath);
      if (stats.isSymbolicLink()) {
        throw new FileError(`Symlink detected at ${filePath}. Security policy prohibits following symlinks.`);
      }
    }
  } catch (error: any) {
    if (error instanceof FileError) throw error;
    // If file doesn't exist yet, it's fine for now (e.g. creating a new directory)
  }

  if (baseDir) {
    const absoluteBaseDir = path.resolve(baseDir);
    if (!absolutePath.startsWith(absoluteBaseDir)) {
      throw new FileError(`Directory traversal detected: ${filePath} is outside of ${baseDir}`);
    }
  }
  return absolutePath;
}

/**
 * Checks if a directory is safe (exists and is not a symlink).
 */
export function ensureSafeDir(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      return;
    }
    const stats = fs.lstatSync(dirPath);
    if (stats.isSymbolicLink()) {
      throw new FileError(`Symlink detected at directory ${dirPath}. Security policy prohibits following symlinks.`);
    }
  } catch (error: any) {
    if (error instanceof FileError) throw error;
    throw new FileError(`Failed to ensure safe directory ${dirPath}: ${error.message}`);
  }
}
