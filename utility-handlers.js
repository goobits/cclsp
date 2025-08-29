import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/file-editor.js
var exports_file_editor = {};
__export(exports_file_editor, {
  renameFile: () => renameFile,
  cleanupBackups: () => cleanupBackups,
  applyWorkspaceEdit: () => applyWorkspaceEdit
});
import { readFile, readdir, stat } from "node:fs/promises";
import { constants, access } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { readdir as readdir2 } from "node:fs/promises";
import { dirname, extname as extname2, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
async function loadGitignore(projectPath) {
  const ig = import_ignore.default();
  ig.add(DEFAULT_IGNORE_PATTERNS);
  const gitignorePath = join(projectPath, ".gitignore");
  try {
    await access(gitignorePath, constants.F_OK);
    const gitignoreContent = await readFile(gitignorePath, "utf-8");
    ig.add(gitignoreContent);
  } catch (error) {}
  return ig;
}
async function scanDirectoryForExtensions(dirPath, maxDepth = 3, ignoreFilter, debug = false) {
  const extensions = new Set;
  async function scanDirectory(currentPath, currentDepth, relativePath = "") {
    if (currentDepth > maxDepth)
      return;
    try {
      const entries = await readdir(currentPath);
      if (debug) {
        process.stderr.write(`Scanning directory ${currentPath} (depth: ${currentDepth}), found ${entries.length} entries: ${entries.join(", ")}
`);
      }
      for (const entry of entries) {
        const fullPath = join(currentPath, entry);
        const entryRelativePath = relativePath ? join(relativePath, entry) : entry;
        const normalizedPath = entryRelativePath.replace(/\\/g, "/");
        if (ignoreFilter?.ignores(normalizedPath)) {
          if (debug) {
            process.stderr.write(`Skipping ignored entry: ${entryRelativePath}
`);
          }
          continue;
        }
        try {
          const fileStat = await stat(fullPath);
          if (fileStat.isDirectory()) {
            if (debug) {
              process.stderr.write(`Recursing into directory: ${entryRelativePath}
`);
            }
            await scanDirectory(fullPath, currentDepth + 1, entryRelativePath);
          } else if (fileStat.isFile()) {
            const ext = extname(entry).toLowerCase().slice(1);
            if (debug) {
              process.stderr.write(`Found file: ${entry}, extension: "${ext}"
`);
            }
            if (ext) {
              extensions.add(ext);
              if (debug) {
                process.stderr.write(`Added extension: ${ext}
`);
              }
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          process.stderr.write(`Error processing file ${fullPath} (stat/type check): ${errorMsg}
`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error reading directory ${currentPath} (readdir operation): ${errorMsg}
`);
      return;
    }
  }
  await scanDirectory(dirPath, 0);
  return extensions;
}
function getRecommendedLanguageServers(extensions, languageServers) {
  const recommended = [];
  for (const server of languageServers) {
    const hasMatchingExtension = server.extensions.some((ext) => extensions.has(ext));
    if (hasMatchingExtension) {
      recommended.push(server.name);
    }
  }
  return recommended;
}
async function scanProjectFiles(projectPath, languageServers, maxDepth = 3, debug = false) {
  const ignoreFilter = await loadGitignore(projectPath);
  const extensions = await scanDirectoryForExtensions(projectPath, maxDepth, ignoreFilter, debug);
  const recommendedServers = getRecommendedLanguageServers(extensions, languageServers);
  return {
    extensions,
    recommendedServers
  };
}
function pathToUri(filePath) {
  return pathToFileURL(filePath).toString();
}
function uriToPath(uri) {
  return fileURLToPath(uri);
}
async function applyWorkspaceEdit(workspaceEdit, options = {}) {
  const {
    validateBeforeApply = true,
    createBackupFiles = validateBeforeApply,
    lspClient
  } = options;
  const backups = [];
  const filesModified = [];
  const backupFilePaths = [];
  if (!workspaceEdit.changes || Object.keys(workspaceEdit.changes).length === 0) {
    return {
      success: true,
      filesModified: [],
      backupFiles: []
    };
  }
  try {
    for (const [uri, edits] of Object.entries(workspaceEdit.changes)) {
      const filePath = uriToPath(uri);
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      const stats = lstatSync(filePath);
      if (stats.isSymbolicLink()) {
        try {
          const realPath = realpathSync(filePath);
          const targetStats = statSync(realPath);
          if (!targetStats.isFile()) {
            throw new Error(`Symlink target is not a file: ${realPath}`);
          }
        } catch (error) {
          throw new Error(`Cannot resolve symlink ${filePath}: ${error}`);
        }
      } else if (!stats.isFile()) {
        throw new Error(`Not a file: ${filePath}`);
      }
      try {
        readFileSync(filePath, "utf-8");
      } catch (error) {
        throw new Error(`Cannot read file: ${filePath} - ${error}`);
      }
    }
    for (const [uri, edits] of Object.entries(workspaceEdit.changes)) {
      const originalPath = uriToPath(uri);
      let targetPath = originalPath;
      const originalStats = lstatSync(originalPath);
      if (originalStats.isSymbolicLink()) {
        targetPath = realpathSync(originalPath);
        process.stderr.write(`[DEBUG] Editing symlink target: ${targetPath} (via ${originalPath})
`);
      }
      const originalContent = readFileSync(targetPath, "utf-8");
      const backup = {
        originalPath,
        targetPath,
        originalContent
      };
      backups.push(backup);
      if (createBackupFiles) {
        const backupPath = `${originalPath}.bak`;
        writeFileSync(backupPath, originalContent, "utf-8");
        backupFilePaths.push(backupPath);
      }
      const modifiedContent = applyEditsToContent(originalContent, edits, validateBeforeApply);
      const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      writeFileSync(tempPath, modifiedContent, "utf-8");
      try {
        renameSync(tempPath, targetPath);
      } catch (error) {
        try {
          if (existsSync(tempPath)) {
            unlinkSync(tempPath);
          }
        } catch {}
        throw error;
      }
      filesModified.push(originalPath);
      if (lspClient) {
        await lspClient.syncFileContent(originalPath);
      }
    }
    return {
      success: true,
      filesModified,
      backupFiles: backupFilePaths
    };
  } catch (error) {
    for (const backup of backups) {
      try {
        writeFileSync(backup.targetPath, backup.originalContent, "utf-8");
      } catch (rollbackError) {
        console.error(`Failed to rollback ${backup.targetPath}:`, rollbackError);
      }
    }
    return {
      success: false,
      filesModified: [],
      backupFiles: backupFilePaths,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function applyEditsToContent(content, edits, validate) {
  const lineEnding = content.includes(`\r
`) ? `\r
` : `
`;
  const lines = content.split(/\r?\n/);
  const sortedEdits = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });
  for (const edit of sortedEdits) {
    const { start, end } = edit.range;
    if (validate) {
      if (start.line < 0 || start.line >= lines.length) {
        throw new Error(`Invalid start line ${start.line} (file has ${lines.length} lines)`);
      }
      if (end.line < 0 || end.line >= lines.length) {
        throw new Error(`Invalid end line ${end.line} (file has ${lines.length} lines)`);
      }
      if (start.line > end.line || start.line === end.line && start.character > end.character) {
        throw new Error(`Invalid range: start (${start.line}:${start.character}) is after end (${end.line}:${end.character})`);
      }
      const startLine = lines[start.line];
      if (startLine !== undefined) {
        if (start.character < 0 || start.character > startLine.length) {
          throw new Error(`Invalid start character ${start.character} on line ${start.line} (line has ${startLine.length} characters)`);
        }
      }
      const endLine = lines[end.line];
      if (endLine !== undefined) {
        if (end.character < 0 || end.character > endLine.length) {
          throw new Error(`Invalid end character ${end.character} on line ${end.line} (line has ${endLine.length} characters)`);
        }
      }
    }
    if (start.line === end.line) {
      const line = lines[start.line];
      if (line !== undefined) {
        lines[start.line] = line.substring(0, start.character) + edit.newText + line.substring(end.character);
      }
    } else {
      const startLine = lines[start.line];
      const endLine = lines[end.line];
      if (startLine !== undefined && endLine !== undefined) {
        const newLine = startLine.substring(0, start.character) + edit.newText + endLine.substring(end.character);
        lines.splice(start.line, end.line - start.line + 1, newLine);
      }
    }
  }
  return lines.join(lineEnding);
}
function cleanupBackups(backupFiles) {
  for (const backupPath of backupFiles) {
    try {
      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }
    } catch (error) {
      console.error(`Failed to remove backup file ${backupPath}:`, error);
    }
  }
}
async function findPotentialImporters(rootDir, targetPath) {
  const files = [];
  const extensions = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
  const { loadGitignore: loadGitignore2 } = await Promise.resolve().then(() => (init_file_scanner(), exports_file_scanner));
  const ignoreFilter = await loadGitignore2(rootDir);
  async function* getFiles(dir, baseDir = dir) {
    const entries = await readdir2(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      if (ignoreFilter.ignores(relativePath.replace(/\\/g, "/"))) {
        continue;
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        yield* getFiles(fullPath, baseDir);
      } else if (entry.isFile()) {
        const ext = extname2(entry.name).slice(1);
        if (extensions.has(ext)) {
          yield fullPath;
        }
      }
    }
  }
  for await (const file of getFiles(rootDir, rootDir)) {
    if (file !== targetPath) {
      files.push(file);
    }
  }
  return files;
}
function findImportsInFile(filePath, oldTargetPath, newTargetPath) {
  const content = readFileSync(filePath, "utf-8");
  const edits = [];
  const lines = content.split(`
`);
  const fileDir = dirname(filePath);
  const oldPathNoExt = oldTargetPath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
  const newPathNoExt = newTargetPath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
  let oldRelative = relative(fileDir, oldPathNoExt).replace(/\\/g, "/");
  let newRelative = relative(fileDir, newPathNoExt).replace(/\\/g, "/");
  if (!oldRelative.startsWith(".") && !oldRelative.startsWith("/")) {
    oldRelative = `./${oldRelative}`;
  }
  if (!newRelative.startsWith(".") && !newRelative.startsWith("/")) {
    newRelative = `./${newRelative}`;
  }
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const oldPattern = escapeRegex(oldRelative);
  const importPattern = new RegExp(`((?:from|require\\s*\\(|import\\s*\\(|export\\s+.*?from)\\s+['"\`])${oldPattern}(['"\`])`, "g");
  lines.forEach((line, lineIndex) => {
    let match;
    importPattern.lastIndex = 0;
    while ((match = importPattern.exec(line)) !== null) {
      const startCol = match.index + (match[1]?.length || 0);
      const endCol = startCol + oldRelative.length;
      edits.push({
        range: {
          start: { line: lineIndex, character: startCol },
          end: { line: lineIndex, character: endCol }
        },
        newText: newRelative
      });
    }
  });
  return edits;
}
async function renameFile(oldPath, newPath, lspClient, options = {}) {
  const { dry_run = false, rootDir = process.cwd() } = options;
  const absoluteOldPath = resolve(oldPath);
  const absoluteNewPath = resolve(newPath);
  if (!existsSync(absoluteOldPath)) {
    return {
      success: false,
      filesModified: [],
      backupFiles: [],
      error: `File does not exist: ${absoluteOldPath}`
    };
  }
  if (existsSync(absoluteNewPath)) {
    return {
      success: false,
      filesModified: [],
      backupFiles: [],
      error: `Target file already exists: ${absoluteNewPath}`
    };
  }
  try {
    process.stderr.write(`[DEBUG] Finding files that import ${absoluteOldPath}
`);
    const importingFiles = await findPotentialImporters(rootDir, absoluteOldPath);
    process.stderr.write(`[DEBUG] Found ${importingFiles.length} potential importing files
`);
    const changes = {};
    let totalEdits = 0;
    for (const file of importingFiles) {
      const edits = findImportsInFile(file, absoluteOldPath, absoluteNewPath);
      if (edits.length > 0) {
        changes[pathToUri(file)] = edits;
        totalEdits += edits.length;
        process.stderr.write(`[DEBUG] Found ${edits.length} imports in ${file}
`);
      }
    }
    const workspaceEdit = { changes };
    if (dry_run) {
      const filesWithImports = Object.keys(changes).map((uri) => uriToPath(uri));
      return {
        success: true,
        filesModified: [],
        backupFiles: [],
        importUpdates: workspaceEdit,
        error: `[DRY RUN] Would update ${totalEdits} imports in ${filesWithImports.length} files and rename ${absoluteOldPath} to ${absoluteNewPath}`
      };
    }
    let result = {
      success: true,
      filesModified: [],
      backupFiles: []
    };
    if (totalEdits > 0) {
      process.stderr.write(`[DEBUG] Applying ${totalEdits} import updates
`);
      result = await applyWorkspaceEdit(workspaceEdit, {
        lspClient
      });
      if (!result.success) {
        return {
          ...result,
          error: `Failed to update imports: ${result.error}`
        };
      }
    }
    process.stderr.write(`[DEBUG] Renaming file from ${absoluteOldPath} to ${absoluteNewPath}
`);
    const newDir = dirname(absoluteNewPath);
    if (!existsSync(newDir)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(newDir, { recursive: true });
    }
    renameSync(absoluteOldPath, absoluteNewPath);
    result.filesModified.push(absoluteNewPath);
    if (lspClient) {
      await lspClient.syncFileContent(absoluteNewPath);
    }
    return {
      ...result,
      importUpdates: workspaceEdit
    };
  } catch (error) {
    return {
      success: false,
      filesModified: [],
      backupFiles: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
var __create2, __getProtoOf2, __defProp2, __getOwnPropNames2, __hasOwnProp2, __toESM2 = (mod, isNodeMode, target) => {
  target = mod != null ? __create2(__getProtoOf2(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames2(mod))
    if (!__hasOwnProp2.call(to, key))
      __defProp2(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
}, __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports), __export2 = (target, all) => {
  for (var name in all)
    __defProp2(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
}, __esm2 = (fn, res) => () => (fn && (res = fn(fn = 0)), res), require_ignore, exports_file_scanner, import_ignore, DEFAULT_IGNORE_PATTERNS, init_file_scanner;
var init_file_editor = __esm(() => {
  __create2 = Object.create;
  __getProtoOf2 = Object.getPrototypeOf;
  __defProp2 = Object.defineProperty;
  __getOwnPropNames2 = Object.getOwnPropertyNames;
  __hasOwnProp2 = Object.prototype.hasOwnProperty;
  require_ignore = __commonJS((exports, module) => {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = undefined;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
    var REGEX_TEST_TRAILING_SLASH = /\/$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(REGEX_REGEXP_RANGE, (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY);
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        /^\uFEFF/,
        () => EMPTY
      ],
      [
        /((?:\\\\)*?)(\\?\s+)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      [
        /(\\+?)\s/g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      [
        /^\//,
        () => "^"
      ],
      [
        /\//g,
        () => "\\/"
      ],
      [
        /^\^*\\\*\\\*\\\//,
        () => "^(?:.*\\/)?"
      ],
      [
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      [
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      [
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        /\\\\/g,
        () => ESCAPE
      ],
      [
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${sanitizeRange(range)}${endEscape}]` : "[]" : "[]"
      ],
      [
        /(?:[^*])$/,
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var makeRegexPrefix = (pattern) => REPLACERS.reduce((prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)), pattern);
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);

    class IgnoreRule {
      constructor(pattern, mark, body, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = this.regexPrefix.replace(REGEX_REPLACE_TRAILING_WILDCARD, TRAILING_WILD_CARD_REPLACERS[mode]);
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    }
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body = pattern;
      if (body.indexOf("!") === 0) {
        negative = true;
        body = body.substr(1);
      }
      body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body);
      return new IgnoreRule(pattern, mark, body, ignoreCase, negative, regexPrefix);
    };

    class RuleManager {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      add(pattern) {
        this._added = false;
        makeArray(isString(pattern) ? splitPattern(pattern) : pattern).forEach(this._add, this);
        return this._added;
      }
      test(path, checkUnignored, mode) {
        let ignored = false;
        let unignored = false;
        let matchedRule;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule[mode].test(path);
          if (!matched) {
            return;
          }
          ignored = !negative;
          unignored = negative;
          matchedRule = negative ? UNDEFINED : rule;
        });
        const ret = {
          ignored,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    }
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path, originalPath, doThrow) => {
      if (!isString(path)) {
        return doThrow(`path must be a string, but got \`${originalPath}\``, TypeError);
      }
      if (!path) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path)) {
        const r = "`path.relative()`d";
        return doThrow(`path should be a ${r} string, but got "${originalPath}"`, RangeError);
      }
      return true;
    };
    var isNotRelative = (path) => REGEX_TEST_INVALID_PATH.test(path);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;

    class Ignore {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = Object.create(null);
        this._testCache = Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      addPattern(pattern) {
        return this.add(pattern);
      }
      _test(originalPath, cache, checkUnignored, slices) {
        const path = originalPath && checkPath.convert(originalPath);
        checkPath(path, originalPath, this._strictPathCheck ? throwError : RETURN_FALSE);
        return this._t(path, cache, checkUnignored, slices);
      }
      checkIgnore(path) {
        if (!REGEX_TEST_TRAILING_SLASH.test(path)) {
          return this.test(path);
        }
        const slices = path.split(SLASH).filter(Boolean);
        slices.pop();
        if (slices.length) {
          const parent = this._t(slices.join(SLASH) + SLASH, this._testCache, true, slices);
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path, false, MODE_CHECK_IGNORE);
      }
      _t(path, cache, checkUnignored, slices) {
        if (path in cache) {
          return cache[path];
        }
        if (!slices) {
          slices = path.split(SLASH).filter(Boolean);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path] = this._rules.test(path, checkUnignored, MODE_IGNORE);
        }
        const parent = this._t(slices.join(SLASH) + SLASH, cache, checkUnignored, slices);
        return cache[path] = parent.ignored ? parent : this._rules.test(path, checkUnignored, MODE_IGNORE);
      }
      ignores(path) {
        return this._test(path, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path) => !this.ignores(path);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      test(path) {
        return this._test(path, this._testCache, true);
      }
    }
    var factory = (options) => new Ignore(options);
    var isPathValid = (path) => checkPath(path && checkPath.convert(path), path, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path) || isNotRelative(path);
    };
    if (typeof process !== "undefined" && process.platform === "win32") {
      setupWindows();
    }
    module.exports = factory;
    factory.default = factory;
    module.exports.isPathValid = isPathValid;
    define(module.exports, Symbol.for("setupWindows"), setupWindows);
  });
  exports_file_scanner = {};
  __export2(exports_file_scanner, {
    scanProjectFiles: () => scanProjectFiles,
    scanDirectoryForExtensions: () => scanDirectoryForExtensions,
    loadGitignore: () => loadGitignore,
    getRecommendedLanguageServers: () => getRecommendedLanguageServers
  });
  init_file_scanner = __esm2(() => {
    import_ignore = __toESM2(require_ignore(), 1);
    DEFAULT_IGNORE_PATTERNS = [
      "node_modules",
      ".git",
      ".svn",
      ".hg",
      "dist",
      "build",
      "out",
      "target",
      "bin",
      "obj",
      ".next",
      ".nuxt",
      "coverage",
      ".nyc_output",
      "temp",
      "cache",
      ".cache",
      ".vscode",
      ".idea",
      "*.log",
      ".DS_Store",
      "Thumbs.db"
    ];
  });
});

// src/mcp/handlers/utility-handlers.ts
import { existsSync as existsSync2, unlinkSync as unlinkSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { mkdirSync } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { dirname as dirname2 } from "node:path";
async function handleGetDiagnostics(diagnosticService, args) {
  const { file_path } = args;
  const absolutePath = resolve2(file_path);
  try {
    const diagnostics = await diagnosticService.getDiagnostics(absolutePath);
    if (diagnostics.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No diagnostics found for ${file_path}. The file has no errors, warnings, or hints.`
          }
        ]
      };
    }
    const severityMap = {
      1: "Error",
      2: "Warning",
      3: "Information",
      4: "Hint"
    };
    const diagnosticMessages = diagnostics.map((diag) => {
      const severity = diag.severity ? severityMap[diag.severity] || "Unknown" : "Unknown";
      const code = diag.code ? ` [${diag.code}]` : "";
      const source = diag.source ? ` (${diag.source})` : "";
      const { start, end } = diag.range;
      return `• ${severity}${code}${source}: ${diag.message}
  Location: Line ${start.line + 1}, Column ${start.character + 1} to Line ${end.line + 1}, Column ${end.character + 1}`;
    });
    return {
      content: [
        {
          type: "text",
          text: `Found ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} in ${file_path}:

${diagnosticMessages.join(`

`)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting diagnostics: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
async function handleRestartServer(newLspClient, args) {
  const { extensions } = args;
  try {
    const restartedServers = await newLspClient.restartServer(extensions);
    let response = `Successfully restarted ${restartedServers.length} LSP server(s)`;
    if (restartedServers.length > 0) {
      response += `

Restarted servers:
${restartedServers.map((s) => `• ${s}`).join(`
`)}`;
    }
    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error restarting servers: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
async function handleRenameFile(args) {
  const { old_path, new_path, dry_run = false } = args;
  try {
    const { renameFile: renameFile2 } = await Promise.resolve().then(() => (init_file_editor(), exports_file_editor));
    const result = await renameFile2(old_path, new_path, undefined, { dry_run });
    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to rename file: ${result.error}`
          }
        ]
      };
    }
    if (dry_run) {
      const message = result.error || "[DRY RUN] No changes would be made";
      return {
        content: [
          {
            type: "text",
            text: message
          }
        ]
      };
    }
    const importCount = result.importUpdates ? Object.keys(result.importUpdates.changes || {}).length : 0;
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully renamed ${old_path} to ${new_path}

Files modified: ${result.filesModified.length}
${importCount > 0 ? `Files with updated imports: ${importCount}` : "No import updates needed"}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error renaming file: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
async function handleCreateFile(args) {
  const { file_path, content = "", overwrite = false } = args;
  const absolutePath = resolve2(file_path);
  try {
    if (existsSync2(absolutePath) && !overwrite) {
      return {
        content: [
          {
            type: "text",
            text: `File ${file_path} already exists. Use overwrite: true to replace it.`
          }
        ]
      };
    }
    const parentDir = dirname2(absolutePath);
    if (!existsSync2(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync2(absolutePath, content, "utf8");
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully created ${file_path}${content ? ` with ${content.length} characters` : " (empty file)"}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating file: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
async function handleDeleteFile(args) {
  const { file_path, force = false } = args;
  const absolutePath = resolve2(file_path);
  try {
    if (!existsSync2(absolutePath)) {
      return {
        content: [
          {
            type: "text",
            text: `File ${file_path} does not exist.`
          }
        ]
      };
    }
    unlinkSync2(absolutePath);
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully deleted ${file_path}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error deleting file: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
export {
  handleRestartServer,
  handleRenameFile,
  handleGetDiagnostics,
  handleDeleteFile,
  handleCreateFile
};
