import type * as vscode from "vscode";

export type NodeKind =
	| "program"
	| "class"
	| "actor"
	| "function"
	| "block"
	| "variable";

export interface ASTNode {
	kind: NodeKind;
	name: string;
	line: number;
	startLine: number;
	endLine: number;
	children: ASTNode[];
	parent: ASTNode | null;
}

export interface SymbolInfo {
	name: string;
	kind: vscode.CompletionItemKind;
	line: number;
	node: ASTNode;
}
