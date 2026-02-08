/**
 * Service to parse .env files into structured key-value pairs.
 * Handles comments, empty lines, quoted values, and multiline values.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ParsedEnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
  line: number;
  comment?: string;
}

export interface ParsedEnvFile {
  filePath: string;
  fileName: string;
  variables: ParsedEnvVariable[];
  comments: string[];
  errors: string[];
}

const SECRET_PATTERNS = [
  'SECRET',
  'PASSWORD',
  'PASSWD',
  'KEY',
  'TOKEN',
  'API_KEY',
  'PRIVATE',
  'CREDENTIAL',
];

/**
 * Determine if a key name likely contains a secret value.
 */
export function isSecretKey(key: string): boolean {
  const upperKey = key.toUpperCase();
  return SECRET_PATTERNS.some((pattern) => upperKey.includes(pattern));
}

/**
 * Mask a secret value, showing only first and last 2 characters.
 * Values shorter than 6 characters are fully masked.
 */
export function maskValue(value: string): string {
  if (value.length <= 5) {
    return '*'.repeat(value.length);
  }
  const first = value.slice(0, 2);
  const last = value.slice(-2);
  const masked = '*'.repeat(Math.max(value.length - 4, 3));
  return `${first}${masked}${last}`;
}

/**
 * Remove surrounding quotes from a value string.
 */
function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a .env file into structured key-value pairs.
 */
export function parseEnvFile(filePath: string): ParsedEnvFile {
  const resolvedPath = path.resolve(filePath);
  const fileName = path.basename(resolvedPath);
  const result: ParsedEnvFile = {
    filePath: resolvedPath,
    fileName,
    variables: [],
    comments: [],
    errors: [],
  };

  let content: string;
  try {
    content = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    result.errors.push(
      `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Collect comments
    if (trimmed.startsWith('#')) {
      result.comments.push(trimmed.slice(1).trim());
      i++;
      continue;
    }

    // Parse KEY=VALUE
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      result.errors.push(`Line ${i + 1}: Invalid format (no '=' found): ${trimmed}`);
      i++;
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    const lineNumber = i + 1;

    // Handle inline comment (only for unquoted values)
    let inlineComment: string | undefined;
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        inlineComment = value.slice(commentIndex + 2).trim();
        value = value.slice(0, commentIndex).trim();
      }
    }

    // Handle multiline quoted values
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      const quote = value[0];
      const parts = [value.slice(1)];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trimEnd().endsWith(quote)) {
          parts.push(nextLine.trimEnd().slice(0, -1));
          break;
        }
        parts.push(nextLine);
        i++;
      }
      value = parts.join('\n');
    } else {
      value = unquote(value);
    }

    result.variables.push({
      key,
      value,
      isSecret: isSecretKey(key),
      line: lineNumber,
      ...(inlineComment ? { comment: inlineComment } : {}),
    });

    i++;
  }

  return result;
}

/**
 * Parse a .env file and return variables with secret values masked.
 */
export function parseEnvFileWithMasking(filePath: string): ParsedEnvFile {
  const parsed = parseEnvFile(filePath);
  return {
    ...parsed,
    variables: parsed.variables.map((v) => ({
      ...v,
      value: v.isSecret ? maskValue(v.value) : v.value,
    })),
  };
}
