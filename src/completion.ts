import * as vscode from "vscode";
import { KEYWORDS } from "./keywords";
import { Parser } from "./parser";
import { ScopeResolver } from "./scope";

export default class Completion implements vscode.CompletionItemProvider {
	private parser: Parser | null = null;
	private resolver = new ScopeResolver();

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): vscode.ProviderResult<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		const items: vscode.CompletionItem[] = [];

		// Add keywords
		KEYWORDS.forEach((kw) => {
			const item = new vscode.CompletionItem(kw.label, kw.kind);
			item.documentation = new vscode.MarkdownString(kw.documentation);
			items.push(item);
		});

		// Parse document into AST
		this.parser = new Parser(document.getText());
		const ast = this.parser.parse();

		// Get symbols visible at cursor position
		const visibleSymbols = this.resolver.getSymbolsAtLine(ast, position.line);
		visibleSymbols.forEach((sym) => {
			const item = new vscode.CompletionItem(sym.name, sym.kind);
			item.detail = `Defined at line ${sym.line + 1}`;
			items.push(item);
		});

		return items;
	}
}
