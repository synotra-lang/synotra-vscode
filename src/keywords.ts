import * as vscode from "vscode";

export interface KeywordDefinition {
	label: string;
	kind: vscode.CompletionItemKind;
	detail: string;
}

export const KEYWORDS: KeywordDefinition[] = [
	{
		label: "class",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a class.",
	},
	{
		label: "actor",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines an actor.",
	},
	{
		label: "io",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines an IO block.",
	},
	{
		label: "fun",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a function.",
	},
	{
		label: "var",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a variable.",
	},
	{
		label: "val",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines an immutable variable.",
	},
	{
		label: "if",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a conditional statement.",
	},
	{
		label: "else",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines an alternative branch in a conditional statement.",
	},
	{
		label: "while",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a while loop.",
	},
	{
		label: "for",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Defines a for loop.",
	},
	{
		label: "return",
		kind: vscode.CompletionItemKind.Keyword,
		detail: "Specifies the return value of a function.",
	},
	{
		label: "println",
		kind: vscode.CompletionItemKind.Function,
		detail: "Prints a line to the console.",
	},
	{
		label: "print",
		kind: vscode.CompletionItemKind.Function,
		detail: "Prints to the console without a newline.",
	},
	{
		label: "ask",
		kind: vscode.CompletionItemKind.Function,
		detail: "聞いてください",
	},
	{
		label: "send",
		kind: vscode.CompletionItemKind.Function,
		detail: "送ってください",
	},
	{
		label: "List",
		kind: vscode.CompletionItemKind.Class,
		detail: "Defines a List collection.",
	},
	{
		label: "MutableMap",
		kind: vscode.CompletionItemKind.Class,
		detail: "Defines a MutableMap collection.",
	},
	{
		label: "MutableSet",
		kind: vscode.CompletionItemKind.Class,
		detail: "Defines a MutableSet collection.",
	},
];
