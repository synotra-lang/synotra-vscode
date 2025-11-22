import * as vscode from "vscode";
import { KEYWORDS } from "./keywords";
import { parseDocument } from "./parser";

export default class Completion implements vscode.CompletionItemProvider {
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): vscode.ProviderResult<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		const items: vscode.CompletionItem[] = [];

		KEYWORDS.forEach((kw) => {
			const item = new vscode.CompletionItem(kw.label, kw.kind);
			item.documentation = new vscode.MarkdownString(kw.documentation);
			items.push(item);
		});

		const text = document.getText();
		const symbols = parseDocument(text);
		symbols.forEach((sym) => {
			const item = new vscode.CompletionItem(sym.name, sym.kind);
			item.detail = `Defined at line ${sym.line + 1}`;
			items.push(item);
		});

		return items;
	}
}
