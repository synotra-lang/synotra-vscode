import * as vscode from "vscode";
import type { ASTNode } from "../core/ast";
import { Parser } from "../core/parser";
import { TypeParser } from "./engine";
import { InferenceEngine, type TypeInfo } from "./inference";
import { TypeRegistry } from "./types";

interface CacheEntry {
	version: number;
	ast: ASTNode;
	types: Map<string, TypeInfo>;
	lines: string[];
}

/**
 * Shared service for document parsing and type inference with caching.
 * This service is shared across all providers (Completion, Hover, Inlay)
 * to avoid redundant computation.
 */
export class DocumentInferenceService implements vscode.Disposable {
	private engine: InferenceEngine;
	private cache = new Map<string, CacheEntry>(); // uri -> CacheEntry
	private disposables: vscode.Disposable[] = [];
	public typeParser = new TypeParser();
	public typeRegistry = new TypeRegistry(this.typeParser);

	constructor() {
		this.engine = new InferenceEngine(this.typeRegistry, this.typeParser);
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
		lines: string[];
	} {
		const uri = document.uri.toString();
		const version = document.version;
		const cached = this.cache.get(uri);

		if (cached?.version === version) {
			return { ast: cached.ast, types: cached.types, lines: cached.lines };
		}

		// Cache miss: parse and infer
		const text = document.getText();
		const lines = text.split(/\r?\n/);
		const parser = new Parser(text);
		const ast = parser.parse();
		const types = this.engine.inferFromText(text, ast);

		// Collect user-defined types from AST
		this.typeRegistry.collectUserTypes(ast, lines);

		this.cache.set(uri, { version, ast, types, lines });

		return { ast, types, lines };
	}

	dispose() {
		this.disposables.forEach((d) => {
			d.dispose();
		});
		this.cache.clear();
	}
}
