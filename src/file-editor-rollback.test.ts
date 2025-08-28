import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyWorkspaceEdit } from './file-editor.js';
import { pathToUri } from './utils.js';

const TEST_DIR = process.env.CI
  ? `${process.cwd()}/test-tmp/file-editor-rollback-test`
  : '/tmp/file-editor-rollback-test';

describe.skipIf(!!process.env.CI)('file-editor rollback without backups', () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should rollback changes when createBackups=false and an error occurs', async () => {
    console.log(`[TEST DEBUG] Test starting, TEST_DIR: ${TEST_DIR}`);
    console.log(`[TEST DEBUG] Directory exists at test start: ${existsSync(TEST_DIR)}`);

    const file1 = join(TEST_DIR, 'file1.ts');
    const file2 = join(TEST_DIR, 'file2.ts');

    console.log(`[TEST DEBUG] Creating files: ${file1}, ${file2}`);

    const originalContent1 = 'const x = 1;';
    const originalContent2 = 'const y = 2;';

    try {
      writeFileSync(file1, originalContent1);
      console.log('[TEST DEBUG] file1 written successfully');
      console.log(`[TEST DEBUG] file1 realpath: ${realpathSync(file1)}`);
    } catch (error) {
      console.log(`[TEST DEBUG] file1 write/realpath failed: ${error}`);
      throw error;
    }

    try {
      writeFileSync(file2, originalContent2);
      console.log('[TEST DEBUG] file2 written successfully');
      console.log(`[TEST DEBUG] file2 realpath: ${realpathSync(file2)}`);
    } catch (error) {
      console.log(`[TEST DEBUG] file2 write/realpath failed: ${error}`);
      throw error;
    }

    console.log(
      `[TEST DEBUG] Files created - file1 exists: ${existsSync(file1)}, file2 exists: ${existsSync(file2)}`
    );

    // Add small delay to see if timing issue
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log(
      `[TEST DEBUG] After 10ms delay - file1 exists: ${existsSync(file1)}, file2 exists: ${existsSync(file2)}`
    );

    // Create an edit that will succeed on file1 but fail on file2
    const result = await applyWorkspaceEdit(
      {
        changes: {
          [pathToUri(file1)]: [
            {
              range: {
                start: { line: 0, character: 6 },
                end: { line: 0, character: 7 },
              },
              newText: 'a',
            },
          ],
          [pathToUri(file2)]: [
            {
              range: {
                start: { line: 10, character: 0 }, // Invalid line - will cause failure
                end: { line: 10, character: 5 },
              },
              newText: 'invalid',
            },
          ],
        },
      },
      {
        validateBeforeApply: true,
      }
    );

    // Should have failed
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid start line');

    // Check that file1 was rolled back to original content even without backup file
    const content1 = readFileSync(file1, 'utf-8');
    expect(content1).toBe(originalContent1);

    // Verify no backup files were created
    expect(existsSync(`${file1}.bak`)).toBe(false);
    expect(existsSync(`${file2}.bak`)).toBe(false);
  });

  it('should handle multi-line edit with invalid character positions', async () => {
    const filePath = join(TEST_DIR, 'test.ts');
    const content = 'line1\nline2\nline3';
    writeFileSync(filePath, content);

    // Multi-line edit where end character exceeds line length
    const result = await applyWorkspaceEdit(
      {
        changes: {
          [pathToUri(filePath)]: [
            {
              range: {
                start: { line: 0, character: 3 },
                end: { line: 2, character: 100 }, // line3 only has 5 characters
              },
              newText: 'replaced',
            },
          ],
        },
      },
      { validateBeforeApply: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid end character');
    expect(result.error).toContain('line has 5 characters');

    // File should be unchanged
    const unchangedContent = readFileSync(filePath, 'utf-8');
    expect(unchangedContent).toBe(content);
  });

  it('should detect inverted ranges (start > end)', async () => {
    const filePath = join(TEST_DIR, 'test.ts');
    writeFileSync(filePath, 'const x = 1;\nconst y = 2;');

    const result = await applyWorkspaceEdit(
      {
        changes: {
          [pathToUri(filePath)]: [
            {
              range: {
                start: { line: 1, character: 5 },
                end: { line: 0, character: 2 }, // End before start
              },
              newText: 'invalid',
            },
          ],
        },
      },
      { validateBeforeApply: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid range');
    expect(result.error).toContain('start (1:5) is after end (0:2)');
  });

  it('should detect same-line inverted character positions', async () => {
    const filePath = join(TEST_DIR, 'test.ts');
    writeFileSync(filePath, 'const x = 1;');

    const result = await applyWorkspaceEdit(
      {
        changes: {
          [pathToUri(filePath)]: [
            {
              range: {
                start: { line: 0, character: 10 },
                end: { line: 0, character: 5 }, // End character before start
              },
              newText: 'invalid',
            },
          ],
        },
      },
      { validateBeforeApply: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid range');
    expect(result.error).toContain('start (0:10) is after end (0:5)');
  });
});
