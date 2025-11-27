import * as vscode from "vscode";
import { typeToString } from "./inference";
import type { DocumentInferenceService } from "./inferenceService";
import { KEYWORDS } from "./keywords";
import { ScopeResolver } from "./scope";
import type { MethodInfo } from "./types";

export default class Completion implements vscode.CompletionItemProvider {
	private resolver = new ScopeResolver();

	constructor(private inferenceService: DocumentInferenceService) {}

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.ProviderResult<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		const lineText = document.lineAt(position.line).text;
		const textBeforeCursor = lineText.substring(0, position.character);

		// Check for dot completion: "variable." pattern
		const dotMatch = textBeforeCursor.match(
			/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)?$/,
		);

		if (dotMatch) {
			// Method/field completion mode
			const objectName = dotMatch[1];
			const partial = dotMatch[2] || "";
			return this.provideMethodCompletions(document, objectName, partial);
		}

		// Default completion: variables, keywords
		return this.provideDefaultCompletions(document, position);
	}

	/**
	 * Provide method and field completions for dot expressions (e.g., "list.")
	 */
	private provideMethodCompletions(
		document: vscode.TextDocument,
		objectName: string,
		partial: string,
	): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = [];
		const { types } = this.inferenceService.getInferenceResult(document);
		const typeRegistry = this.inferenceService.typeRegistry;

		// Get the type of the variable
		const varType = types.get(objectName);
		if (!varType) {
			return items;
		}

		// Get methods for this type
		const methods = typeRegistry.getMethodsForType(varType);
		for (const method of methods) {
			if (
				partial &&
				!method.name.toLowerCase().startsWith(partial.toLowerCase())
			) {
				continue;
			}

			const item = new vscode.CompletionItem(
				method.name,
				vscode.CompletionItemKind.Method,
			);
			item.detail = this.formatMethodSignature(method);
			item.documentation = method.documentation;
			item.insertText = this.createMethodSnippet(method);
			item.sortText = "0"; // Prioritize methods
			items.push(item);
		}

		// Get fields for this type (user-defined types only)
		const fields = typeRegistry.getFieldsForType(varType);
		for (const field of fields) {
			if (
				partial &&
				!field.name.toLowerCase().startsWith(partial.toLowerCase())
			) {
				continue;
			}

			const item = new vscode.CompletionItem(
				field.name,
				vscode.CompletionItemKind.Field,
			);
			item.detail = `${field.mutable ? "var" : "val"} ${field.name}: ${typeToString(field.type)}`;
			item.sortText = "1"; // Fields after methods
			items.push(item);
		}

		return items;
	}

	/**
	 * Format method signature for display
	 * e.g., "add(element: T) -> Unit"
	 */
	private formatMethodSignature(method: MethodInfo): string {
		const params = method.params
			.map((p) => `${p.name}: ${typeToString(p.type)}`)
			.join(", ");
		const returnType = typeToString(method.returnType);
		return `(${params}) -> ${returnType}`;
	}

	/**
	 * Create snippet for method insertion with parameter placeholders
	 * e.g., "add(${1:element})"
	 */
	private createMethodSnippet(method: MethodInfo): vscode.SnippetString {
		if (method.params.length === 0) {
			return new vscode.SnippetString(`${method.name}()`);
		}

		const paramSnippets = method.params
			.map((p, i) => `\${${i + 1}:${p.name}}`)
			.join(", ");
		return new vscode.SnippetString(`${method.name}(${paramSnippets})`);
	}

	/**
	 * Provide default completions (variables, keywords)
	 */
	private provideDefaultCompletions(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.CompletionItem[] {
		const items: vscode.CompletionItem[] = [];

		// Get AST and inferred types from shared service
		const { ast, types } = this.inferenceService.getInferenceResult(document);

		// Add keywords (keep lower priority than local symbols)
		KEYWORDS.forEach((kw) => {
			const item = new vscode.CompletionItem(kw.label, kw.kind);
			item.detail = kw.detail;
			item.sortText = "2";
			items.push(item);
		});

		// Get symbols visible at cursor position and attach inferred types
		const visibleSymbols = this.resolver.getSymbolsAtLine(ast, position.line);
		visibleSymbols.forEach((sym) => {
			if (position.line !== sym.line) {
				const item = new vscode.CompletionItem(sym.name, sym.kind);
				const inferred = types.get(sym.name);
				item.detail =
					`Defined at line ${sym.line + 1}` +
					(inferred ? ` - ${typeToString(inferred)}` : "");
				// Prioritize symbols with known types
				item.sortText = inferred ? "0" : "1";
				items.push(item);
			}
		});

		return items;
	}
}
