import * as vscode from "vscode";
import type { ASTNode } from "./ast";
import { KEYWORDS } from "./keywords";
import { Parser } from "./parser";
import { ScopeResolver } from "./scope";

export default class Completion implements vscode.CompletionItemProvider {
	private resolver = new ScopeResolver();
	private cachedAST: { ast: ASTNode; version: number; uri: string } | null =
		null;

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.ProviderResult<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		const items: vscode.CompletionItem[] = [];

		// Add keywords
		KEYWORDS.forEach((kw) => {
			const item = new vscode.CompletionItem(kw.label, kw.kind);
			item.detail = kw.detail;
			items.push(item);
		});

		// Parse document into AST (with caching)
		const ast = this.getOrParseAST(document);

		// Get symbols visible at cursor position
		const visibleSymbols = this.resolver.getSymbolsAtLine(ast, position.line);
		visibleSymbols.forEach((sym) => {
			const item = new vscode.CompletionItem(sym.name, sym.kind);
			item.detail = `Defined at line ${sym.line + 1}`;
			items.push(item);
		});

		return items;
	}

	private getOrParseAST(document: vscode.TextDocument): ASTNode {
		const currentVersion = document.version;
		const currentUri = document.uri.toString();

		// Check if we have a cached AST for this document version
		if (
			this.cachedAST &&
			this.cachedAST.uri === currentUri &&
			this.cachedAST.version === currentVersion
		) {
			return this.cachedAST.ast;
		}

		// Parse the document and cache the result
		const parser = new Parser(document.getText());
		const ast = parser.parse();
		this.cachedAST = {
			ast,
			version: currentVersion,
			uri: currentUri,
		};

		return ast;
	}
}
