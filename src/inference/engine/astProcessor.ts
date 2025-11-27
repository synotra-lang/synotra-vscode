import type { ASTNode } from "../../core/ast";
import type { TypeInfo } from "../inference";
import type { TypeParser } from "./typeParser";

function make(
	kind:
		| "Int"
		| "String"
		| "Bool"
		| "List"
		| "MutableMap"
		| "MutableSet"
		| "Function"
		| "Custom"
		| "Unknown"
		| "Unit",
	generics?: TypeInfo[],
	readonlyName?: string,
	hasTypeAnnotation?: boolean,
): TypeInfo {
	return { kind, generics, readonlyName, hasTypeAnnotation };
}

/**
 * Handles AST-based processing for type inference.
 * Collects variable declarations and function return types from the AST.
 */
export class ASTProcessor {
	private types: Map<string, TypeInfo>;
	private functionReturnTypes: Map<string, TypeInfo>;
	private typeParser: TypeParser;

	constructor(
		types: Map<string, TypeInfo>,
		functionReturnTypes: Map<string, TypeInfo>,
		typeParser: TypeParser,
	) {
		this.types = types;
		this.functionReturnTypes = functionReturnTypes;
		this.typeParser = typeParser;
	}

	/**
	 * Collect all variable declarations from the AST.
	 * Initializes each variable with Unknown type that may be refined later.
	 */
	public collectDeclarationsFromAST(ast: ASTNode): void {
		const stack: ASTNode[] = [ast];
		while (stack.length) {
			const node = stack.pop();
			if (!node) {
				continue;
			}
			if (node.kind === "variable") {
				if (!this.types.has(node.name)) {
					this.types.set(node.name, make("Unknown"));
				}
			}
			for (const c of node.children) {
				stack.push(c);
			}
		}
	}

	/**
	 * Collect function return types from AST.
	 * Parses function definitions like "fun x() -> Int" or "io fun y(a: String) -> Bool"
	 */
	public collectFunctionReturnTypes(ast: ASTNode, lines: string[]): void {
		const stack: ASTNode[] = [ast];
		while (stack.length) {
			const node = stack.pop();
			if (!node) {
				continue;
			}
			if (node.kind === "function") {
				const returnType = this.parseFunctionReturnType(node, lines);
				if (returnType) {
					this.functionReturnTypes.set(node.name, returnType);
				}
			}
			for (const c of node.children) {
				stack.push(c);
			}
		}
	}

	/**
	 * Parse function return type from source line.
	 * e.g., "fun doSomething(x: Int): Bool" returns Bool
	 * e.g., "fun process(): String" returns String
	 * e.g., "io fun log(msg: String)" returns always Unit (skip io functions)
	 */
	private parseFunctionReturnType(
		node: ASTNode,
		lines: string[],
	): TypeInfo | null {
		if (node.line < 0 || node.line >= lines.length) {
			return null;
		}

		const line = lines[node.line].trim();

		// Match: fun name(params) -> returnType
		const funMatch = line.match(
			/fun\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:\s*(.+?)\s*\{?$/,
		);
		if (funMatch) {
			return this.typeParser.parseTypeString(funMatch[1].trim());
		}

		return null;
	}
}
