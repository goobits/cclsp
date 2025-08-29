import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getRecommendedLanguageServers,
  loadGitignore,
  scanDirectoryForExtensions,
  scanProjectFiles,
} from '../../src/file-scanner.js';
import { LANGUAGE_SERVERS } from '../../src/language-server-presets.js';
import { cleanupTestDir, createTestDir } from './test-helpers.js';

let TEST_DIR: string;

describe('file-scanner', () => {
  beforeEach(() => {
    // Create a unique test directory for each test
    TEST_DIR = createTestDir('file-scanner-test');
  });

  afterEach(() => {
    // Clean up test directory
    cleanupTestDir(TEST_DIR);
  });

  describe('loadGitignore', () => {
    it('should load default ignore patterns', async () => {
      const ig = await loadGitignore(TEST_DIR);

      // Test that default patterns are loaded
      expect(ig.ignores('node_modules')).toBe(true);
      expect(ig.ignores('dist')).toBe(true);
      expect(ig.ignores('.git')).toBe(true);
      expect(ig.ignores('src')).toBe(false);
    });

    it('should load custom gitignore patterns', async () => {
      await writeFile(join(TEST_DIR, '.gitignore'), 'custom_dir\n*.log\n');

      const ig = await loadGitignore(TEST_DIR);

      expect(ig.ignores('custom_dir')).toBe(true);
      expect(ig.ignores('test.log')).toBe(true);
      expect(ig.ignores('test.txt')).toBe(false);
    });

    it('should handle missing .gitignore gracefully', async () => {
      const ig = await loadGitignore(TEST_DIR);

      // Should still have default patterns
      expect(ig.ignores('node_modules')).toBe(true);
      expect(ig.ignores('regular_file')).toBe(false);
    });
  });

  describe('scanDirectoryForExtensions', () => {
    it('should find file extensions', async () => {
      await writeFile(join(TEST_DIR, 'test'), 'console.log("test");');
      await writeFile(join(TEST_DIR, 'app'), 'console.log("app");');
      await writeFile(join(TEST_DIR, 'main.py'), 'print("hello")');

      const extensions = await scanDirectoryForExtensions(TEST_DIR);

      expect(extensions.has('ts')).toBe(true);
      expect(extensions.has('js')).toBe(true);
      expect(extensions.has('py')).toBe(true);
    });

    it('should respect gitignore patterns', async () => {
      await writeFile(join(TEST_DIR, '.gitignore'), 'ignored.ts\nignored_dir/\n');

      // Create files - some should be ignored
      await writeFile(join(TEST_DIR, 'normal'), 'console.log("normal");');
      await writeFile(join(TEST_DIR, 'ignored'), 'console.log("ignored");');

      await mkdir(join(TEST_DIR, 'ignored_dir'), { recursive: true });
      await writeFile(join(TEST_DIR, 'ignored_dir', 'file'), 'console.log("ignored");');

      const ig = await loadGitignore(TEST_DIR);
      const extensions = await scanDirectoryForExtensions(TEST_DIR, 3, ig);

      // Should find TypeScript extension from normal.ts but not from ignored files
      expect(extensions.has('ts')).toBe(true);
      expect(extensions.has('js')).toBe(false); // js file was in ignored directory
    });

    it('should skip common ignore patterns by default', async () => {
      // Create files in directories that should be ignored
      await mkdir(join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true });
      await writeFile(join(TEST_DIR, 'node_modules', 'pkg', 'index'), 'module.exports = {};');

      await mkdir(join(TEST_DIR, 'dist'), { recursive: true });
      await writeFile(join(TEST_DIR, 'dist', 'build'), 'console.log("build");');

      // Create a file that should be included
      await writeFile(join(TEST_DIR, 'src'), 'console.log("source");');

      const ig = await loadGitignore(TEST_DIR);
      const extensions = await scanDirectoryForExtensions(TEST_DIR, 3, ig);

      // Should only find TypeScript, not JavaScript from ignored directories
      expect(extensions.has('ts')).toBe(true);
      expect(extensions.has('js')).toBe(false);
    });

    it('should respect maxDepth parameter', async () => {
      // Create nested directories
      await mkdir(join(TEST_DIR, 'level1', 'level2', 'level3', 'level4'), { recursive: true });
      await writeFile(
        join(TEST_DIR, 'level1', 'level2', 'level3', 'level4', 'deep.rs'),
        'fn main() {}'
      );
      await writeFile(join(TEST_DIR, 'level1', 'shallow.go'), 'package main');

      const extensions = await scanDirectoryForExtensions(TEST_DIR, 2);

      // Should find go at level 2 but not rust at level 4
      expect(extensions.has('go')).toBe(true);
      expect(extensions.has('rs')).toBe(false);
    });
  });

  describe('getRecommendedLanguageServers', () => {
    it('should recommend servers based on extensions', () => {
      const extensions = new Set(['ts', 'js', 'py', 'go']);
      const recommended = getRecommendedLanguageServers(extensions, LANGUAGE_SERVERS);

      expect(recommended).toContain('typescript');
      expect(recommended).toContain('python');
      expect(recommended).toContain('go');
      expect(recommended).not.toContain('rust'); // rs extension not in set
    });

    it('should return empty array for unknown extensions', () => {
      const extensions = new Set(['unknown', 'fake']);
      const recommended = getRecommendedLanguageServers(extensions, LANGUAGE_SERVERS);

      expect(recommended).toHaveLength(0);
    });

    it('should handle empty extensions set', () => {
      const extensions = new Set<string>();
      const recommended = getRecommendedLanguageServers(extensions, LANGUAGE_SERVERS);

      expect(recommended).toHaveLength(0);
    });
  });

  describe('scanProjectFiles', () => {
    it('should return complete scan result', async () => {
      await writeFile(join(TEST_DIR, 'app'), 'console.log("app");');
      await writeFile(join(TEST_DIR, 'main.py'), 'print("hello")');

      const result = await scanProjectFiles(TEST_DIR, LANGUAGE_SERVERS);

      expect(result.extensions.has('ts')).toBe(true);
      expect(result.extensions.has('py')).toBe(true);
      expect(result.recommendedServers).toContain('typescript');
      expect(result.recommendedServers).toContain('python');
    });

    it('should respect gitignore in full scan', async () => {
      await writeFile(join(TEST_DIR, '.gitignore'), '*.temp\n');
      await writeFile(join(TEST_DIR, 'app'), 'console.log("app");');
      await writeFile(join(TEST_DIR, 'ignore.temp'), 'temp file');

      const result = await scanProjectFiles(TEST_DIR, LANGUAGE_SERVERS);

      expect(result.extensions.has('ts')).toBe(true);
      expect(result.extensions.has('temp')).toBe(false);
      expect(result.recommendedServers).toContain('typescript');
    });
  });
});
