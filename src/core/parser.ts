import {
	type ActorNameMatch,
	type ClassNameMatch,
	type DeclarationKeywordAndNameMatch,
	extractActorName,
	extractClassName,
	extractDeclarationKeywordAndName,
	extractFunctionNameWithOptionalIo,
	type FunctionNameWithOptionalIoMatch,
	RegexPatterns,
} from "../inference/engine/regexPatterns";
import type { ASTNode } from "./ast";

export class Parser {
	private lines: string[];

	constructor(text: string) {
		this.lines = text.split("\n");
	}

	parse(): ASTNode {
		const root: ASTNode = {
			kind: "program",
			name: "root",
			line: 0,
			startLine: 0,
			endLine: this.lines.length - 1,
			children: [],
			parent: null,
		};

		this.parseTopLevel(root, 0, this.lines.length - 1);
		return root;
	}

	/**
	 * Process a class definition match into an AST node.
	 */
	private processClassDefinition(
		match: ClassNameMatch,
		line: string,
		lineIndex: number,
		parent: ASTNode,
	): ASTNode {
		const blockEnd = this.findBlockEnd(lineIndex);
		const classNode: ASTNode = {
			kind: "class",
			name: match.name,
			line: lineIndex,
			startLine: lineIndex,
			endLine: blockEnd,
			children: [],
			parent,
		};
		this.parseBlockContent(classNode, lineIndex + 1, blockEnd);
		this.parseArguments(line, classNode, lineIndex);
		return classNode;
	}

	/**
	 * Process an actor definition match into an AST node.
	 */
	private processActorDefinition(
		match: ActorNameMatch,
		line: string,
		lineIndex: number,
		parent: ASTNode,
	): ASTNode {
		const blockEnd = this.findBlockEnd(lineIndex);
		const actorNode: ASTNode = {
			kind: "actor",
			name: match.name,
			line: lineIndex,
			startLine: lineIndex,
			endLine: blockEnd,
			children: [],
			parent,
		};
		this.parseBlockContent(actorNode, lineIndex + 1, blockEnd);
		this.parseArguments(line, actorNode, lineIndex);
		return actorNode;
	}

	/**
	 * Process a function definition match into an AST node.
	 */
	private processFunctionDefinition(
		match: FunctionNameWithOptionalIoMatch,
		line: string,
		lineIndex: number,
		parent: ASTNode,
	): ASTNode {
		const blockEnd = this.findBlockEnd(lineIndex);
		const funNode: ASTNode = {
			kind: "function",
			name: match.name,
			line: lineIndex,
			startLine: lineIndex,
			endLine: blockEnd,
			children: [],
			parent,
		};
		this.parseBlockContent(funNode, lineIndex + 1, blockEnd);
		this.parseArguments(line, funNode, lineIndex);
		return funNode;
	}

	/**
	 * Process a variable definition match into an AST node.
	 */
	private processVariableDefinition(
		match: DeclarationKeywordAndNameMatch,
		lineIndex: number,
		parent: ASTNode,
	): ASTNode {
		return {
			kind: "variable",
			name: match.name,
			line: lineIndex,
			startLine: lineIndex,
			endLine: lineIndex,
			children: [],
			parent,
		};
	}

	private parseTopLevel(
		parent: ASTNode,
		startLine: number,
		endLine: number,
	): void {
		for (let i = startLine; i <= endLine; i++) {
			const line = this.lines[i];

			// Match class definitions
			const classMatch = extractClassName(line);
			if (classMatch) {
				const classNode = this.processClassDefinition(
					classMatch,
					line,
					i,
					parent,
				);
				i = classNode.endLine;
				parent.children.push(classNode);
				continue;
			}

			// Match actor definitions
			const actorMatch = extractActorName(line);
			if (actorMatch) {
				const actorNode = this.processActorDefinition(
					actorMatch,
					line,
					i,
					parent,
				);
				i = actorNode.endLine;
				parent.children.push(actorNode);
				continue;
			}

			// Match function definitions at global scope: fun funcName or io fun funcName
			const funMatch = extractFunctionNameWithOptionalIo(line);
			if (funMatch) {
				const funNode = this.processFunctionDefinition(
					funMatch,
					line,
					i,
					parent,
				);
				i = funNode.endLine;
				parent.children.push(funNode);
			}
		}
	}

	private parseBlockContent(
		parent: ASTNode,
		startLine: number,
		endLine: number,
	): void {
		for (let i = startLine; i <= endLine; i++) {
			const line = this.lines[i];

			// Match function definitions: fun funcName or io fun funcName
			const funMatch = extractFunctionNameWithOptionalIo(line);
			if (funMatch) {
				const funNode = this.processFunctionDefinition(
					funMatch,
					line,
					i,
					parent,
				);
				i = funNode.endLine;
				parent.children.push(funNode);
				continue;
			}

			// Match variable definitions: var varName or val varName
			const varMatch = extractDeclarationKeywordAndName(line);
			if (varMatch) {
				const varNode = this.processVariableDefinition(varMatch, i, parent);
				parent.children.push(varNode);
				continue;
			}

			// Match while/if/else/for blocks
			if (
				line.includes("while") ||
				line.includes("if") ||
				line.includes("else") ||
				line.includes("for")
			) {
				const blockEnd = this.findBlockEnd(i);
				const blockNode: ASTNode = {
					kind: "block",
					name: `block_${i}`,
					line: i,
					startLine: i,
					endLine: blockEnd,
					children: [],
					parent,
				};
				this.parseBlockContent(blockNode, i + 1, blockEnd);
				parent.children.push(blockNode);
				i = blockEnd;
			}
		}
	}

	private parseArguments(
		line: string,
		parentNode: ASTNode,
		lineNumber: number,
	): void {
		const argumentsMatch = line.match(
			RegexPatterns.PARAMETER.ARGUMENT_NAME_IN_SIGNATURE,
		);
		if (argumentsMatch) {
			argumentsMatch.forEach((argName) => {
				const argNode: ASTNode = {
					kind: "variable",
					name: argName.trim(),
					line: lineNumber,
					startLine: lineNumber,
					endLine: lineNumber,
					children: [],
					parent: parentNode,
				};
				parentNode.children.push(argNode);
			});
		}
	}

	private findBlockEnd(startLine: number): number {
		let braceCount = 0;
		let foundStart = false;

		for (let i = startLine; i < this.lines.length; i++) {
			const line = this.lines[i];
			for (const char of line) {
				if (char === "{") {
					braceCount++;
					foundStart = true;
				} else if (char === "}") {
					braceCount--;
					if (foundStart && braceCount === 0) {
						return i;
					}
				}
			}
		}
		return this.lines.length - 1;
	}
}
