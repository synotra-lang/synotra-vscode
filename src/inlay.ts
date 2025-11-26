import * as vscode from "vscode";
import { typeToString } from "./inference";
import type { DocumentInferenceService } from "./inferenceService";

export default class Inlay implements vscode.InlayHintsProvider {
	constructor(private inferenceService: DocumentInferenceService) {}

	provideInlayHints(
		document: vscode.TextDocument,
		_range: vscode.Range,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.InlayHint[]> {
		const text = document.getText();
		const lines = text.split(/\r?\n/);
		const hints: vscode.InlayHint[] = [];

		const initRegex = /^\s*(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:|\b)/;

		// Get inferred types from shared service
		const { types } = this.inferenceService.getInferenceResult(document);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const m = line.match(initRegex);
			if (!m) {
				continue;
			}
			const name = m[1];
			const inferred = types.get(name);
			if (!inferred) {
				continue;
			}
			const col = line.indexOf(name) + name.length;
			const label = `: ${typeToString(inferred)}`;
			const hint = new vscode.InlayHint(
				new vscode.Position(i, col),
				label,
				vscode.InlayHintKind.Type,
			);
			// [nitpick] Setting paddingLeft = true without paddingRight may cause inconsistent spacing.
			// The hint shows : Type immediately after the variable name with a space before the colon but none after.
			// For better readability, consider also setting paddingRight = false (or omitting it if it defaults to false) to make the spacing intention explicit, or adjust the label format.
			// Suggested by GitHub Copilot
			hint.paddingLeft = true;
			hint.paddingRight = false;
			// Only show hint if no type annotation exists
			if (line.includes(":") && line.indexOf(":") < line.indexOf("=")) {
				continue;
			}

			hints.push(hint);
		}

		return hints;
	}
}
