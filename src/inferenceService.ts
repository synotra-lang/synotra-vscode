import * as vscode from "vscode";
import type { ASTNode } from "./ast";
import { InferenceEngine, type TypeInfo } from "./inference";
import { Parser } from "./parser";

interface CacheEntry {
	version: number;
	ast: ASTNode;
	types: Map<string, TypeInfo>;
}

/**
 * Shared service for document parsing and type inference with caching.
 * This service is shared across all providers (Completion, Hover, Inlay)
 * to avoid redundant computation.
 */
export class DocumentInferenceService implements vscode.Disposable {
	private engine = new InferenceEngine();
	private cache = new Map<string, CacheEntry>(); // uri -> CacheEntry
	private disposables: vscode.Disposable[] = [];

	constructor() {
		// Invalidate cache when document changes
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				this.cache.delete(e.document.uri.toString());
			}),
		);

		// Remove cache entry when document is closed
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument((doc) => {
				this.cache.delete(doc.uri.toString());
			}),
		);
	}

	/**
	 * Get the AST and inferred type information for a document.
	 * Results are cached by document URI and version.
	 */
	public getInferenceResult(document: vscode.TextDocument): {
		ast: ASTNode;
		types: Map<string, TypeInfo>;
	} {
		const uri = document.uri.toString();
		const version = document.version;
		const cached = this.cache.get(uri);

		if (cached?.version === version) {
			return { ast: cached.ast, types: cached.types };
		}

		// Cache miss: parse and infer
		const text = document.getText();
		const parser = new Parser(text);
		const ast = parser.parse();
		const types = this.engine.inferFromText(text, ast);

		this.cache.set(uri, { version, ast, types });

		return { ast, types };
	}

	dispose() {
		this.disposables.forEach((d) => {
			d.dispose();
		});
		this.cache.clear();
	}
}
