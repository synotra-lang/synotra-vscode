// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import Completion from "./completion";
import Hover from "./hover";
import { DocumentInferenceService } from "./inferenceService";
import Inlay from "./inlay";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("synotra-vscode is now active! YATTAZE!");

	// Create a shared inference service for all providers
	const inferenceService = new DocumentInferenceService();
	context.subscriptions.push(inferenceService);

	const completionProvider = vscode.languages.registerCompletionItemProvider(
		"synotra",
		new Completion(inferenceService),
	);
	context.subscriptions.push(completionProvider);

	const hover = vscode.languages.registerHoverProvider(
		"synotra",
		new Hover(inferenceService),
	);
	context.subscriptions.push(hover);

	const inlay = vscode.languages.registerInlayHintsProvider(
		"synotra",
		new Inlay(inferenceService),
	);
	context.subscriptions.push(inlay);
}

// This method is called when your extension is deactivated
export function deactivate() {}
