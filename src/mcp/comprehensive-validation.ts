/**
 * Comprehensive validation system for all MCP handler arguments
 * Replaces unsafe type assertions with proper runtime validation
 */

import type {
  ApplyWorkspaceEditArgs,
  CreateFileArgs,
  DeleteFileArgs,
  FindDefinitionArgs,
  FindReferencesArgs,
  FormatDocumentArgs,
  GetCallHierarchyIncomingCallsArgs,
  GetCallHierarchyOutgoingCallsArgs,
  GetCodeActionsArgs,
  GetCompletionsArgs,
  GetDiagnosticsArgs,
  GetDocumentLinksArgs,
  GetDocumentSymbolsArgs,
  GetFoldingRangesArgs,
  GetHoverArgs,
  GetInlayHintsArgs,
  GetSelectionRangeArgs,
  GetSemanticTokensArgs,
  GetSignatureHelpArgs,
  GetTypeHierarchySubtypesArgs,
  GetTypeHierarchySupertypesArgs,
  HealthCheckArgs,
  PrepareCallHierarchyArgs,
  PrepareTypeHierarchyArgs,
  RenameFileArgs,
  RenameSymbolArgs,
  RenameSymbolStrictArgs,
  RestartServerArgs,
  SearchWorkspaceSymbolsArgs,
} from './handler-types.js';

// Utility type guards
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && (value as number) >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || isBoolean(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}

// Position validation
function isPosition(value: unknown): value is { line: number; character: number } {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    'line' in obj &&
    'character' in obj &&
    isNonNegativeInteger(obj.line) &&
    isNonNegativeInteger(obj.character)
  );
}

// Range validation
function isRange(value: unknown): value is {
  start: { line: number; character: number };
  end: { line: number; character: number };
} {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return 'start' in obj && 'end' in obj && isPosition(obj.start) && isPosition(obj.end);
}

// Array validation
function isArrayOf<T>(value: unknown, itemValidator: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  return value.every(itemValidator);
}

// Core handler validations
export function validateFindDefinitionArgs(args: unknown): args is FindDefinitionArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'symbol_name' in obj &&
    isNonEmptyString(obj.symbol_name) &&
    (!('symbol_kind' in obj) || isOptionalString(obj.symbol_kind))
  );
}

export function validateFindReferencesArgs(args: unknown): args is FindReferencesArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'symbol_name' in obj &&
    isNonEmptyString(obj.symbol_name) &&
    (!('symbol_kind' in obj) || isOptionalString(obj.symbol_kind)) &&
    (!('include_declaration' in obj) || isOptionalBoolean(obj.include_declaration))
  );
}

export function validateRenameSymbolArgs(args: unknown): args is RenameSymbolArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'symbol_name' in obj &&
    isNonEmptyString(obj.symbol_name) &&
    'new_name' in obj &&
    isNonEmptyString(obj.new_name) &&
    (!('symbol_kind' in obj) || isOptionalString(obj.symbol_kind)) &&
    (!('dry_run' in obj) || isOptionalBoolean(obj.dry_run))
  );
}

export function validateRenameSymbolStrictArgs(args: unknown): args is RenameSymbolStrictArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character) &&
    'new_name' in obj &&
    isNonEmptyString(obj.new_name) &&
    (!('dry_run' in obj) || isOptionalBoolean(obj.dry_run))
  );
}

// Advanced handler validations
export function validateGetCodeActionsArgs(args: unknown): args is GetCodeActionsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    (!('range' in obj) || obj.range === undefined || isRange(obj.range))
  );
}

export function validateFormatDocumentArgs(args: unknown): args is FormatDocumentArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  if (!('file_path' in obj) || !isNonEmptyString(obj.file_path)) {
    return false;
  }

  if ('options' in obj && obj.options !== undefined) {
    if (!isObject(obj.options)) return false;
    const options = obj.options as Record<string, unknown>;

    return (
      (!('tab_size' in options) || isOptionalNumber(options.tab_size)) &&
      (!('insert_spaces' in options) || isOptionalBoolean(options.insert_spaces)) &&
      (!('trim_trailing_whitespace' in options) ||
        isOptionalBoolean(options.trim_trailing_whitespace)) &&
      (!('insert_final_newline' in options) || isOptionalBoolean(options.insert_final_newline)) &&
      (!('trim_final_newlines' in options) || isOptionalBoolean(options.trim_final_newlines))
    );
  }

  return true;
}

export function validateSearchWorkspaceSymbolsArgs(
  args: unknown
): args is SearchWorkspaceSymbolsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'query' in obj && isNonEmptyString(obj.query);
}

export function validateGetDocumentSymbolsArgs(args: unknown): args is GetDocumentSymbolsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'file_path' in obj && isNonEmptyString(obj.file_path);
}

export function validateGetFoldingRangesArgs(args: unknown): args is GetFoldingRangesArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'file_path' in obj && isNonEmptyString(obj.file_path);
}

export function validateGetDocumentLinksArgs(args: unknown): args is GetDocumentLinksArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'file_path' in obj && isNonEmptyString(obj.file_path);
}

// Intelligence handler validations
export function validateGetHoverArgs(args: unknown): args is GetHoverArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character)
  );
}

export function validateGetCompletionsArgs(args: unknown): args is GetCompletionsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character) &&
    (!('trigger_character' in obj) || isOptionalString(obj.trigger_character))
  );
}

export function validateGetInlayHintsArgs(args: unknown): args is GetInlayHintsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'start_line' in obj &&
    isNonNegativeInteger(obj.start_line) &&
    'start_character' in obj &&
    isNonNegativeInteger(obj.start_character) &&
    'end_line' in obj &&
    isNonNegativeInteger(obj.end_line) &&
    'end_character' in obj &&
    isNonNegativeInteger(obj.end_character)
  );
}

export function validateGetSemanticTokensArgs(args: unknown): args is GetSemanticTokensArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'file_path' in obj && isNonEmptyString(obj.file_path);
}

export function validateGetSignatureHelpArgs(args: unknown): args is GetSignatureHelpArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character) &&
    (!('trigger_character' in obj) || isOptionalString(obj.trigger_character))
  );
}

// Hierarchy handler validations
export function validatePrepareCallHierarchyArgs(args: unknown): args is PrepareCallHierarchyArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character)
  );
}

export function validateGetCallHierarchyIncomingCallsArgs(
  args: unknown
): args is GetCallHierarchyIncomingCallsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  // Validate CallHierarchyItem structure
  if (!('item' in obj) || !isObject(obj.item)) return false;

  const item = obj.item as Record<string, unknown>;
  return (
    'name' in item &&
    isString(item.name) &&
    'kind' in item &&
    isNumber(item.kind) &&
    'uri' in item &&
    isString(item.uri) &&
    'range' in item &&
    isRange(item.range) &&
    'selectionRange' in item &&
    isRange(item.selectionRange)
  );
}

export function validateGetCallHierarchyOutgoingCallsArgs(
  args: unknown
): args is GetCallHierarchyOutgoingCallsArgs {
  return validateGetCallHierarchyIncomingCallsArgs(args); // Same structure
}

export function validatePrepareTypeHierarchyArgs(args: unknown): args is PrepareTypeHierarchyArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'line' in obj &&
    isNonNegativeInteger(obj.line) &&
    'character' in obj &&
    isNonNegativeInteger(obj.character)
  );
}

export function validateGetTypeHierarchySupertypesArgs(
  args: unknown
): args is GetTypeHierarchySupertypesArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  // Validate TypeHierarchyItem structure
  if (!('item' in obj) || !isObject(obj.item)) return false;

  const item = obj.item as Record<string, unknown>;
  return (
    'name' in item &&
    isString(item.name) &&
    'kind' in item &&
    isNumber(item.kind) &&
    'uri' in item &&
    isString(item.uri) &&
    'range' in item &&
    isRange(item.range) &&
    'selectionRange' in item &&
    isRange(item.selectionRange)
  );
}

export function validateGetTypeHierarchySubtypesArgs(
  args: unknown
): args is GetTypeHierarchySubtypesArgs {
  return validateGetTypeHierarchySupertypesArgs(args); // Same structure
}

export function validateGetSelectionRangeArgs(args: unknown): args is GetSelectionRangeArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    'positions' in obj &&
    isArrayOf(obj.positions, isPosition)
  );
}

// Utility handler validations
export function validateGetDiagnosticsArgs(args: unknown): args is GetDiagnosticsArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return 'file_path' in obj && isNonEmptyString(obj.file_path);
}

export function validateRestartServerArgs(args: unknown): args is RestartServerArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    !('extensions' in obj) || obj.extensions === undefined || isArrayOf(obj.extensions, isString)
  );
}

export function validateRenameFileArgs(args: unknown): args is RenameFileArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'old_path' in obj &&
    isNonEmptyString(obj.old_path) &&
    'new_path' in obj &&
    isNonEmptyString(obj.new_path) &&
    (!('dry_run' in obj) || isOptionalBoolean(obj.dry_run))
  );
}

export function validateCreateFileArgs(args: unknown): args is CreateFileArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    (!('content' in obj) || isOptionalString(obj.content)) &&
    (!('overwrite' in obj) || isOptionalBoolean(obj.overwrite))
  );
}

export function validateDeleteFileArgs(args: unknown): args is DeleteFileArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return (
    'file_path' in obj &&
    isNonEmptyString(obj.file_path) &&
    (!('force' in obj) || isOptionalBoolean(obj.force))
  );
}

export function validateHealthCheckArgs(args: unknown): args is HealthCheckArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  return !('include_details' in obj) || isOptionalBoolean(obj.include_details);
}

export function validateApplyWorkspaceEditArgs(args: unknown): args is ApplyWorkspaceEditArgs {
  if (!isObject(args)) return false;
  const obj = args as Record<string, unknown>;

  if (!('changes' in obj) || !isObject(obj.changes)) return false;

  const changes = obj.changes as Record<string, unknown>;

  // Validate that all values in changes are arrays of TextEdit
  for (const [key, value] of Object.entries(changes)) {
    if (!isString(key) || !Array.isArray(value)) return false;

    for (const edit of value) {
      if (!isObject(edit)) return false;
      const editObj = edit as Record<string, unknown>;

      if (!('range' in editObj) || !isRange(editObj.range)) return false;
      if (!('newText' in editObj) || !isString(editObj.newText)) return false;
    }
  }

  return !('validate_before_apply' in obj) || isOptionalBoolean(obj.validate_before_apply);
}

// Error creation helper
export function createValidationError(toolName: string, expectedStructure: string): Error {
  return new Error(`Invalid arguments for ${toolName}: expected ${expectedStructure}`);
}
