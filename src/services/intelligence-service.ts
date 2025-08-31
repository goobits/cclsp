import type {
  CompletionItem,
  Hover,
  InlayHint,
  InlayHintParams,
  Position,
  SemanticTokens,
  SemanticTokensParams,
  SignatureHelp,
} from '../types.js';
import type { ServiceContext } from './service-context.js';

/**
 * Service for intelligence-related LSP operations
 * Handles hover, completions, signature help, inlay hints, and semantic tokens
 */
export class IntelligenceService {
  constructor(private context: ServiceContext) {}

  /**
   * Get hover information at position
   */
  async getHover(filePath: string, position: Position): Promise<Hover | null> {
    const serverState = await this.context.prepareFile(filePath);
    if (!serverState) {
      throw new Error('No LSP server available for this file type');
    }

    // Give TypeScript Language Server time to process the file
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const response = await this.context.protocol.sendRequest(
        serverState.process,
        'textDocument/hover',
        {
          textDocument: { uri: `file://${filePath}` },
          position,
        },
        30000 // 30 second timeout - give it plenty of time
      );
      return response && typeof response === 'object' && 'contents' in response
        ? (response as Hover)
        : null;
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('timeout')) {
        // Return a fallback hover response
        return {
          contents: {
            kind: 'markdown',
            value: `**Hover information unavailable**\n\nThe TypeScript Language Server did not respond to the hover request at line ${position.line + 1}, character ${position.character + 1}. This feature may not be fully supported in the current server configuration.`,
          },
        };
      }
      throw error;
    }
  }

  /**
   * Get completions at position
   */
  async getCompletions(
    filePath: string,
    position: Position,
    triggerCharacter?: string
  ): Promise<CompletionItem[]> {
    const serverState = await this.context.prepareFile(filePath);
    if (!serverState) {
      throw new Error('No LSP server available for this file type');
    }

    // Give TypeScript Language Server time to process the file
    await new Promise((resolve) => setTimeout(resolve, 500));

    const completionParams = {
      textDocument: { uri: `file://${filePath}` },
      position,
      context: triggerCharacter
        ? {
            triggerKind: 2, // TriggerCharacter
            triggerCharacter,
          }
        : {
            triggerKind: 1, // Invoked
          },
    };

    try {
      const response = await this.context.protocol.sendRequest(
        serverState.process,
        'textDocument/completion',
        completionParams,
        5000 // 5 second timeout
      );

      if (!response || typeof response !== 'object') return [];
      const result = response as { items?: CompletionItem[] };
      return Array.isArray(result.items) ? result.items : result.items || [];
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('timeout')) {
        // Return empty completion list with explanation
        return [
          {
            label: 'Completions unavailable',
            detail: 'TypeScript Language Server timeout',
            documentation:
              'The TypeScript Language Server did not respond to the completion request. This feature may not be fully supported in the current server configuration.',
            insertText: '',
            kind: 1, // Text
          },
        ];
      }
      throw error;
    }
  }

  /**
   * Get signature help at position
   */
  async getSignatureHelp(
    filePath: string,
    position: Position,
    triggerCharacter?: string
  ): Promise<SignatureHelp | null> {
    const serverState = await this.context.prepareFile(filePath);
    if (!serverState) {
      throw new Error('No LSP server available for this file type');
    }

    const signatureHelpParams = {
      textDocument: { uri: `file://${filePath}` },
      position,
      context: triggerCharacter
        ? {
            triggerKind: 2, // TriggerCharacter
            triggerCharacter,
            isRetrigger: false,
          }
        : {
            triggerKind: 1, // Invoked
            isRetrigger: false,
          },
    };

    const response = await this.context.protocol.sendRequest(
      serverState.process,
      'textDocument/signatureHelp',
      signatureHelpParams
    );

    return response && typeof response === 'object' && 'signatures' in response
      ? (response as SignatureHelp)
      : null;
  }

  /**
   * Get inlay hints for range
   */
  async getInlayHints(
    filePath: string,
    range: { start: Position; end: Position }
  ): Promise<InlayHint[]> {
    const serverState = await this.context.prepareFile(filePath);
    if (!serverState) {
      throw new Error('No LSP server available for this file type');
    }

    const inlayHintParams: InlayHintParams = {
      textDocument: { uri: `file://${filePath}` },
      range,
    };

    const response = await this.context.protocol.sendRequest(
      serverState.process,
      'textDocument/inlayHint',
      inlayHintParams
    );

    return Array.isArray(response) ? response : [];
  }

  /**
   * Get semantic tokens for file
   */
  async getSemanticTokens(filePath: string): Promise<SemanticTokens | null> {
    const serverState = await this.context.prepareFile(filePath);
    if (!serverState) {
      throw new Error('No LSP server available for this file type');
    }

    const semanticTokensParams: SemanticTokensParams = {
      textDocument: { uri: `file://${filePath}` },
    };

    const response = await this.context.protocol.sendRequest(
      serverState.process,
      'textDocument/semanticTokens/full',
      semanticTokensParams
    );

    return response && typeof response === 'object' && 'data' in response
      ? (response as SemanticTokens)
      : null;
  }

  // ensureFileOpen() and getLanguageId() methods removed - provided by ServiceContext
  // This eliminates ~45 lines of duplicated code from this service
}
