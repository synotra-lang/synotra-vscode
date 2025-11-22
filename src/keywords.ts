import * as vscode from "vscode";

export interface KeywordDefinition {
	label: string;
	kind: vscode.CompletionItemKind;
	documentation: string;
}

export const KEYWORDS: KeywordDefinition[] = [
	{
		label: "class",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a class.",
	},
	{
		label: "actor",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines an actor.",
	},
	{
		label: "io",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines an IO block.",
	},
	{
		label: "fun",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a function.",
	},
	{
		label: "var",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a variable.",
	},
	{
		label: "val",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines an immutable variable.",
	},
	{
		label: "if",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a conditional statement.",
	},
	{
		label: "else",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines an alternative branch in a conditional statement.",
	},
	{
		label: "while",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a while loop.",
	},
	{
		label: "for",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Defines a for loop.",
	},
	{
		label: "return",
		kind: vscode.CompletionItemKind.Keyword,
		documentation: "Specifies the return value of a function.",
	},
	{
		label: "println",
		kind: vscode.CompletionItemKind.Function,
		documentation: "Prints a line to the console.",
	},
	{
		label: "print",
		kind: vscode.CompletionItemKind.Function,
		documentation: "Prints to the console without a newline.",
	},
	{
		label: "ask",
		kind: vscode.CompletionItemKind.Function,
		documentation: "",
	},
	{
		label: "send",
		kind: vscode.CompletionItemKind.Function,
		documentation: "",
	},
];
