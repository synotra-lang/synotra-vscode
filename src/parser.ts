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

	private parseTopLevel(
		parent: ASTNode,
		startLine: number,
		endLine: number,
	): void {
		for (let i = startLine; i <= endLine; i++) {
			const line = this.lines[i];

			// Match class definitions
			const classMatch = line.match(/\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (classMatch) {
				const classNode: ASTNode = {
					kind: "class",
					name: classMatch[1],
					line: i,
					startLine: i,
					endLine: i,
					children: [],
					parent,
				};
				parent.children.push(classNode);
				continue;
			}

			// Match actor definitions
			const actorMatch = line.match(/\bactor\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (actorMatch) {
				const blockEnd = this.findBlockEnd(i);
				const actorNode: ASTNode = {
					kind: "actor",
					name: actorMatch[1],
					line: i,
					startLine: i,
					endLine: blockEnd,
					children: [],
					parent,
				};
				this.parseBlockContent(actorNode, i + 1, blockEnd);
				parent.children.push(actorNode);
				i = blockEnd;
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
			const funMatch = line.match(/(?:io\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (funMatch) {
				const blockEnd = this.findBlockEnd(i);
				const funNode: ASTNode = {
					kind: "function",
					name: funMatch[1],
					line: i,
					startLine: i,
					endLine: blockEnd,
					children: [],
					parent,
				};
				this.parseBlockContent(funNode, i + 1, blockEnd);
				parent.children.push(funNode);
				i = blockEnd;
				continue;
			}

			// Match variable definitions: var varName or val varName
			const varMatch = line.match(/\b(var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
			if (varMatch) {
				const varNode: ASTNode = {
					kind: "variable",
					name: varMatch[2],
					line: i,
					startLine: i,
					endLine: i,
					children: [],
					parent,
				};
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
