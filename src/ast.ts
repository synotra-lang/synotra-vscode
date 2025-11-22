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

export function debugPrintAST(node: ASTNode, indent: string = ""): void {
	for (const child of node.children) {
		console.log(
			`${indent}${child.kind} "${child.name}" (lines ${child.startLine + 1}-${
				child.endLine + 1
			})`,
		);
		debugPrintAST(child, `${indent}  `);
	}
}
