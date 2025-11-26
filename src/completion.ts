import * as vscode from "vscode";
import { typeToString } from "./inference";
import type { DocumentInferenceService } from "./inferenceService";
import { KEYWORDS } from "./keywords";
import { ScopeResolver } from "./scope";

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
			const item = new vscode.CompletionItem(sym.name, sym.kind);
			const inferred = types.get(sym.name);
			item.detail =
				`Defined at line ${sym.line + 1}` +
				(inferred ? ` - ${typeToString(inferred)}` : "");
			// Prioritize symbols with known types
			item.sortText = inferred ? "0" : "1";
			items.push(item);
		});

		return items;
	}
}
