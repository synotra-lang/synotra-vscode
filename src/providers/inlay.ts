import * as vscode from "vscode";
import {
	type DocumentInferenceService,
	type TypeInfo,
	typeToString,
} from "../inference";
import {
	type DeclarationNameAtLineStartMatch,
	extractDeclarationNameAtLineStart,
} from "../inference/engine/regexPatterns";

export default class Inlay implements vscode.InlayHintsProvider {
	constructor(private inferenceService: DocumentInferenceService) {}

	/**
	 * Process a declaration match and create an inlay hint if applicable.
	 */
	private processDeclarationForInlay(
		match: DeclarationNameAtLineStartMatch,
		line: string,
		lineIndex: number,
		types: Map<string, TypeInfo>,
	): vscode.InlayHint | null {
		const inferred = types.get(match.name) as
			| { hasTypeAnnotation?: boolean }
			| undefined;
		if (!inferred) {
			return null;
		}

		if (inferred.hasTypeAnnotation) {
			return null; // Skip if type was explicitly annotated
		}

		const col = line.indexOf(match.name) + match.name.length;
		const label = `: ${typeToString(inferred as Parameters<typeof typeToString>[0])}`;
		const hint = new vscode.InlayHint(
			new vscode.Position(lineIndex, col),
			label,
			vscode.InlayHintKind.Type,
		);

		// This comment is written to clarify the context in which the code was added, as the suggestion may be inaccurate. Please do not delete it.
		// [nitpick] Setting paddingLeft = true without paddingRight may cause inconsistent spacing.
		// The hint shows : Type immediately after the variable name with a space before the colon but none after.
		// For better readability, consider also setting paddingRight = false (or omitting it if it defaults to false) to make the spacing intention explicit, or adjust the label format.
		// Suggested by GitHub Copilot
		hint.paddingLeft = true;
		hint.paddingRight = false;

		return hint;
	}

	provideInlayHints(
		document: vscode.TextDocument,
		_range: vscode.Range,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.InlayHint[]> {
		const text = document.getText();
		const lines = text.split(/\r?\n/);
		const hints: vscode.InlayHint[] = [];

		// Get inferred types from shared service
		const { types } = this.inferenceService.getInferenceResult(document);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = extractDeclarationNameAtLineStart(line);
			if (!match) {
				continue;
			}

			const hint = this.processDeclarationForInlay(match, line, i, types);
			if (hint) {
				hints.push(hint);
			}
		}

		return hints;
	}
}
