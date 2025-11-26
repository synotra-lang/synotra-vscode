import * as vscode from "vscode";
import { InferenceEngine, typeToString } from "./inference";

export default class Inlay implements vscode.InlayHintsProvider {
	private engine = new InferenceEngine();

	// Cache: document version and uri
	private cache = new Map<
		string, // uri
		{
			version: number;
			hints: vscode.InlayHint[];
		}
	>();

	// When document changes, this disposable will be used to clear the cache
	private disposables: vscode.Disposable[] = [];

	constructor() {
		// If change document, clear cache for that document
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				const uri = e.document.uri.toString();
				this.cache.delete(uri);
			}),
		);

		// If close document, clear cache for that document
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument((doc) => {
				const uri = doc.uri.toString();
				this.cache.delete(uri);
			}),
		);
	}

	dispose() {
		this.disposables.forEach((d) => {
			d.dispose();
		});
		this.cache.clear();
	}

	provideInlayHints(
		document: vscode.TextDocument,
		_range: vscode.Range,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.InlayHint[]> {
		const uri = document.uri.toString();
		const version = document.version;

		const cached = this.cache.get(uri);
		if (cached && cached.version === version) {
			return cached.hints;
		}

		const hints = this.computeInlayHints(document);
		this.cache.set(uri, { version, hints });

		return hints;
	}

	private computeInlayHints(document: vscode.TextDocument): vscode.InlayHint[] {
		const text = document.getText();
		const lines = text.split(/\r?\n/);
		const hints: vscode.InlayHint[] = [];

		const initRegex = /^\s*(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:|\b)/;
		const types = this.engine.inferFromText(text);

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
