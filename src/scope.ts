import * as vscode from "vscode";
import type { ASTNode, SymbolInfo } from "./ast";

export class ScopeResolver {
	getSymbolsAtLine(ast: ASTNode, line: number): SymbolInfo[] {
		const symbols: SymbolInfo[] = [];
		this.collectVisibleSymbols(ast, line, symbols);
		return symbols;
	}

	private collectVisibleSymbols(
		node: ASTNode,
		line: number,
		symbols: SymbolInfo[],
	): void {
		// Skip if node doesn't contain cursor position
		if (line < node.startLine || line > node.endLine) {
			return;
		}

		// Traverse child nodes
		for (const child of node.children) {
			if (child.kind === "variable") {
				// Variables are valid only within their scope
				if (line >= child.line) {
					symbols.push({
						name: child.name,
						kind: vscode.CompletionItemKind.Variable,
						line: child.line,
						node: child,
					});
				}
			} else if (child.kind === "function") {
				// Functions are valid throughout their parent scope
				symbols.push({
					name: child.name,
					kind: vscode.CompletionItemKind.Function,
					line: child.line,
					node: child,
				});
			} else if (child.kind === "class" || child.kind === "actor") {
				// Classes/actors are globally accessible
				symbols.push({
					name: child.name,
					kind: vscode.CompletionItemKind.Class,
					line: child.line,
					node: child,
				});
			}

			// Traverse nested scopes
			this.collectVisibleSymbols(child, line, symbols);
		}
	}

	// Get the definition location of a specific symbol
	getDefinition(ast: ASTNode, name: string): ASTNode | null {
		return this.findNode(ast, name);
	}

	private findNode(node: ASTNode, name: string): ASTNode | null {
		if (node.name === name) {
			return node;
		}
		for (const child of node.children) {
			const result = this.findNode(child, name);
			if (result) {
				return result;
			}
		}
		return null;
	}
}
