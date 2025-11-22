import * as vscode from "vscode";
import { KEYWORDS } from "./keywords";

export default class Completion implements vscode.CompletionItemProvider {
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext,
	): vscode.ProviderResult<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		return KEYWORDS.map((kw) => {
			const item = new vscode.CompletionItem(kw.label, kw.kind);
			item.documentation = new vscode.MarkdownString(kw.documentation);
			return item;
		});
	}
}
