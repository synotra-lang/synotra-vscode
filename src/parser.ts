import * as vscode from "vscode";

export type Symbol = {
	name: string;
	kind: vscode.CompletionItemKind;
	line: number;
};

export function parseDocument(text: string): Symbol[] {
	const symbols: Symbol[] = [];
	const lines = text.split("\n");

	lines.forEach((line, index) => {
		// Match class definitions
		const classMatch = line.match(/\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
		if (classMatch) {
			symbols.push({
				name: classMatch[1],
				kind: vscode.CompletionItemKind.Class,
				line: index,
			});
		}

		// Match actor definitions
		const actorMatch = line.match(/\bactor\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
		if (actorMatch) {
			symbols.push({
				name: actorMatch[1],
				kind: vscode.CompletionItemKind.Class,
				line: index,
			});
		}

		// Match function definitions
		const functionMatch = line.match(
			/(?:io\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
		);
		if (functionMatch) {
			symbols.push({
				name: functionMatch[1],
				kind: vscode.CompletionItemKind.Function,
				line: index,
			});
		}

		// Match variable definitions
		const variableMatch = line.match(/\b(var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
		if (variableMatch) {
			symbols.push({
				name: variableMatch[2],
				kind: vscode.CompletionItemKind.Variable,
				line: index,
			});
		}
	});

	return symbols;
}
