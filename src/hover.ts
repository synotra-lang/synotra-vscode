import * as vscode from "vscode";
import { typeToString } from "./inference";
import type { DocumentInferenceService } from "./inferenceService";

export default class Hover implements vscode.HoverProvider {
	constructor(private inferenceService: DocumentInferenceService) {}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.Hover> {
		const wordRange = document.getWordRangeAtPosition(
			position,
			/[a-zA-Z_][a-zA-Z0-9_]*/,
		);
		if (!wordRange) {
			return null;
		}
		const word = document.getText(wordRange);

		// Get inferred types from shared service
		const { types } = this.inferenceService.getInferenceResult(document);
		const inferred = types.get(word);
		if (inferred) {
			const md = new vscode.MarkdownString();
			md.appendCodeblock(typeToString(inferred), "text");
			md.isTrusted = false;
			return new vscode.Hover(md, wordRange);
		}
		return null;
	}
}
