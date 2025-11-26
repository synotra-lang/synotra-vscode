import type { ASTNode } from "./ast";

export type TypeKind =
	| "Int"
	| "String"
	| "Bool"
	| "List"
	| "MutableMap"
	| "MutableSet"
	| "Function"
	| "Custom"
	| "Unknown";

export interface TypeInfo {
	kind: TypeKind;
	generics?: TypeInfo[]; // e.g. List<T> -> generics = [T]
	readonlyName?: string; // optional friendly name
}

function make(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
): TypeInfo {
	return { kind, generics, readonlyName };
}

export function typeToString(t?: TypeInfo): string {
	if (!t) {
		return "Unknown";
	}
	if (!t.generics || t.generics.length === 0) {
		return t.readonlyName ?? t.kind;
	}
	const gen = t.generics.map((g) => typeToString(g)).join(", ");
	return `${t.readonlyName ?? t.kind}<${gen}>`;
}

export class InferenceEngine {
	private types: Map<string, TypeInfo> = new Map();

	public inferFromText(text: string, ast?: ASTNode): Map<string, TypeInfo> {
		this.types = new Map();
		const lines = text.split(/\r?\n/);
		if (ast) {
			this.collectDeclarationsFromAST(ast);
		}
		this.scanInitializers(lines);
		this.scanCollectionUsages(lines);
		this.scanBinaryOps(lines);
		return this.types;
	}

	private collectDeclarationsFromAST(ast: ASTNode) {
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

	private scanInitializers(lines: string[]) {
		// Match groups:
		// 1: variable name, required
		// 2: type annotation, optional (string | undefined)
		// 3: right-hand side expression, required
		const initRegex =
			/\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::\s*(.+?))?\s*=\s*(.+)$/;
		for (const raw of lines) {
			const line = raw.trim();
			const m = line.match(initRegex);
			if (!m) {
				continue;
			}

			const name = m[1];
			const annotation = m[2];
			const rhs = m[3].trim();

			// If type annotation is undefined, infer from RHS expression
			if (annotation !== undefined) {
				const annotatedType = this.parseTypeString(annotation);
				this.types.set(name, annotatedType);
			} else {
				const inferred = this.inferExpressionType(rhs);
				this.types.set(name, inferred);
			}
		}
	}

	private inferExpressionType(expr: string): TypeInfo {
		// String literal
		if (/^".*"$/.test(expr)) {
			return make("String");
		}
		// Boolean literal
		if (/^(true|false)$/.test(expr)) {
			return make("Bool");
		}
		// Numeric literal (integer or float) -> Int for simplicity
		if (/^[+-]?\d+(\.\d+)?$/.test(expr)) {
			return make("Int");
		}

		// Collection construction: TypeName<...>.new(...)
		// Supports nested generics like List<List<Int>>.new() or Map<String, List<Int>>.new()
		const collectionMatch = expr.match(
			/^\s*(List|MutableMap|MutableSet)\s*(<.+>)?\s*\.new\s*\(/,
		);
		if (collectionMatch) {
			const typeName = collectionMatch[1];
			const kind = this.typeNameToKind(typeName);

			// Extract generic content if present
			const genericContent = this.extractGenericContent(expr);
			if (genericContent) {
				const genericParams = this.parseCommaSeparated(genericContent);
				const generics = genericParams.map((p) => this.parseTypeString(p));
				return make(kind, generics);
			}

			// No generic parameters specified
			switch (kind) {
				case "List":
				case "MutableSet":
					return make(kind, [make("Unknown")]);
				case "MutableMap":
					return make(kind, [make("Unknown"), make("Unknown")]);
				default:
					return make(kind);
			}
		}

		// Function call or identifier -> unknown/custom
		if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.*\)$/.test(expr)) {
			return make("Unknown");
		}
		// Fallback: Unknown
		return make("Unknown");
	}

	/**
	 * Parse comma-separated arguments while respecting nested brackets.
	 * Supports (), [], {}, and <> for generic types.
	 * e.g. "fn(a,b), c, d" -> ["fn(a,b)", "c", "d"]
	 * e.g. "String, List<Int>" -> ["String", "List<Int>"]
	 */
	private parseCommaSeparated(argsString: string): string[] {
		const args: string[] = [];
		let current = "";
		let depth = 0;

		for (const ch of argsString) {
			if (ch === "(" || ch === "[" || ch === "{" || ch === "<") {
				depth++;
				current += ch;
			} else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") {
				depth--;
				current += ch;
			} else if (ch === "," && depth === 0) {
				// Split at top-level commas only
				args.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}

		// Add the last argument
		if (current.trim()) {
			args.push(current.trim());
		}

		return args;
	}

	/**
	 * Parse a type string recursively, handling nested generic types.
	 * e.g. "List<Int>" -> { kind: "List", generics: [{ kind: "Int" }] }
	 * e.g. "MutableMap<String, List<Int>>" -> { kind: "MutableMap", generics: [String, List<Int>] }
	 */
	private parseTypeString(typeStr: string): TypeInfo {
		const trimmed = typeStr.trim();

		// Check for generic type: TypeName<...>
		const genericMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*<(.+)>$/);
		if (genericMatch) {
			const baseName = genericMatch[1];
			const genericsStr = genericMatch[2];

			// Parse the generic type parameters recursively
			const genericParams = this.parseCommaSeparated(genericsStr);
			const generics = genericParams.map((p) => this.parseTypeString(p));

			// Map type name to TypeKind
			const kind = this.typeNameToKind(baseName);
			return make(kind, generics);
		}

		// Simple type without generics
		const kind = this.typeNameToKind(trimmed);
		return make(kind);
	}

	/**
	 * Convert a type name string to TypeKind.
	 */
	private typeNameToKind(name: string): TypeKind {
		switch (name) {
			case "Int":
				return "Int";
			case "String":
				return "String";
			case "Bool":
				return "Bool";
			case "List":
				return "List";
			case "MutableMap":
				return "MutableMap";
			case "MutableSet":
				return "MutableSet";
			case "Function":
				return "Function";
			default:
				return "Unknown";
		}
	}

	/**
	 * Extract the content inside angle brackets from a type expression.
	 * Handles nested angle brackets correctly.
	 * e.g. "List<List<Int>>" -> "List<Int>"
	 * e.g. "Map<String, List<Int>>" -> "String, List<Int>"
	 */
	private extractGenericContent(expr: string): string | null {
		const startIdx = expr.indexOf("<");
		if (startIdx === -1) {
			return null;
		}

		let depth = 0;
		let endIdx = -1;

		for (let i = startIdx; i < expr.length; i++) {
			const ch = expr[i];
			if (ch === "<") {
				depth++;
			} else if (ch === ">") {
				depth--;
				if (depth === 0) {
					endIdx = i;
					break;
				}
			}
		}

		if (endIdx === -1) {
			return null;
		}

		return expr.substring(startIdx + 1, endIdx);
	}

	/**
	 * Parse a method call expression and extract object name, method name, and arguments.
	 * Handles nested parentheses correctly.
	 * e.g. "list.add(fn(1,2))" -> { object: "list", method: "add", args: ["fn(1,2)"] }
	 */
	private parseMethodCall(
		line: string,
	): { object: string; method: string; args: string[] } | null {
		// Match pattern: identifier.identifier(
		const methodMatch = line.match(
			/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
		);
		if (!methodMatch?.index) {
			return null;
		}

		const object = methodMatch[1];
		const method = methodMatch[2];
		const startIndex = methodMatch.index + methodMatch[0].length;

		// Find the matching closing parenthesis
		let depth = 1;
		let endIndex = startIndex;

		for (let i = startIndex; i < line.length && depth > 0; i++) {
			const ch = line[i];
			if (ch === "(") {
				depth++;
			} else if (ch === ")") {
				depth--;
			}
			if (depth > 0) {
				endIndex = i + 1;
			}
		}

		const argsString = line.substring(startIndex, endIndex);
		const args = this.parseCommaSeparated(argsString);

		return { object, method, args };
	}

	private scanCollectionUsages(lines: string[]) {
		// Infer collection types from method calls:
		// list.add(10) -> infer list as List<Int>
		// map.put("key", 20) -> infer map as MutableMap<String, Int>
		// set.add("value") -> infer set as MutableSet<String>
		for (const raw of lines) {
			const line = raw.trim();
			const call = this.parseMethodCall(line);

			if (!call) {
				continue;
			}

			switch (call.method) {
				case "add":
					if (call.args.length === 1) {
						const elemType = this.inferExpressionType(call.args[0]);
						this.mergeListElementType(call.object, elemType);
					}
					break;

				case "put":
					if (call.args.length === 2) {
						const keyType = this.inferExpressionType(call.args[0]);
						const valType = this.inferExpressionType(call.args[1]);
						this.mergeMapTypes(call.object, keyType, valType);
					}
					break;
			}
		}
	}

	private mergeListElementType(listName: string, elemType: TypeInfo) {
		const existing = this.types.get(listName);
		if (!existing || existing.kind === "Unknown") {
			this.types.set(listName, make("List", [elemType]));
			return;
		}
		if (existing.kind === "List") {
			const cur = existing.generics?.[0]
				? existing.generics[0]
				: make("Unknown");
			const merged = this.mergeTypes(cur, elemType);
			this.types.set(listName, make("List", [merged]));
			return;
		}
		// If existing is not a List, leave it unchanged
	}

	private mergeMapTypes(mapName: string, keyType: TypeInfo, valType: TypeInfo) {
		const existing = this.types.get(mapName);
		if (!existing || existing.kind === "Unknown") {
			this.types.set(mapName, make("MutableMap", [keyType, valType]));
			return;
		}
		if (existing.kind === "MutableMap") {
			const curKey = existing.generics?.[0]
				? existing.generics[0]
				: make("Unknown");
			const curVal = existing.generics?.[1]
				? existing.generics[1]
				: make("Unknown");
			const mergedKey = this.mergeTypes(curKey, keyType);
			const mergedVal = this.mergeTypes(curVal, valType);
			this.types.set(mapName, make("MutableMap", [mergedKey, mergedVal]));
			return;
		}
		// If existing is not a MutableMap or Unknown, leave it unchanged but return explicitly for clarity
		return;
	}

	private mergeTypes(a: TypeInfo, b: TypeInfo): TypeInfo {
		// Simple merge: if same kind return that, otherwise Unknown or Custom
		if (a.kind === b.kind) {
			// Merge generics recursively if present
			if (a.generics && b.generics && a.generics.length === b.generics.length) {
				const gens = a.generics.map((g, i) => {
					if (!b.generics) {
						return g;
					}
					return this.mergeTypes(g, b.generics[i]);
				});
				return make(a.kind, gens);
			}
			return a;
		}
		// If one is Unknown return the other
		if (a.kind === "Unknown") {
			return b;
		}
		if (b.kind === "Unknown") {
			return a;
		}
		return a;
	}

	private scanBinaryOps(lines: string[]) {
		for (const raw of lines) {
			const line = raw.trim();

			// Check if this line is a variable assignment
			const assignMatch = line.match(
				/\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)/,
			);
			if (!assignMatch) {
				continue;
			}

			const varName = assignMatch[1];
			const expr = assignMatch[2].trim();

			// Check if expression contains binary operators
			if (!/[+\-*/]/.test(expr)) {
				continue;
			}

			// Infer the type of the entire expression
			const resultType = this.inferBinaryExpressionType(expr);
			if (resultType) {
				this.types.set(varName, resultType);
			}
		}
	}

	private inferBinaryExpressionType(expr: string): TypeInfo | null {
		// Tokenize the expression into operands and operators
		const tokens = this.tokenizeExpression(expr);
		if (tokens.length === 0) {
			return null;
		}

		// If single token, infer its type directly
		if (tokens.length === 1) {
			return this.inferOperandType(tokens[0]);
		}

		// Process left to right: accumulate result type through operators
		let resultType = this.inferOperandType(tokens[0]);

		for (let i = 1; i < tokens.length; i += 2) {
			if (i + 1 >= tokens.length) {
				break; // incomplete expression
			}

			const operator = tokens[i];
			const rightOperand = tokens[i + 1];
			const rightType = this.inferOperandType(rightOperand);

			// Apply type rules for binary operation
			resultType = this.inferBinaryOperationType(
				resultType,
				operator,
				rightType,
			);

			// If result becomes Unknown, no need to continue
			if (resultType.kind === "Unknown") {
				return resultType;
			}
		}

		return resultType;
	}

	private tokenizeExpression(expr: string): string[] {
		// Split by operators while preserving them
		const tokens: string[] = [];
		let current = "";

		for (let i = 0; i < expr.length; i++) {
			const ch = expr[i];
			if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
				const lastToken = tokens[tokens.length - 1];
				const isUnaryAtStart =
					(ch === "+" || ch === "-") &&
					tokens.length === 0 &&
					current.trim() === "";
				const isUnaryAfterOperator =
					(ch === "+" || ch === "-") &&
					(lastToken === "+" ||
						lastToken === "-" ||
						lastToken === "*" ||
						lastToken === "/") &&
					current.trim() === "";
				if (isUnaryAtStart || isUnaryAfterOperator) {
					current += ch;
					continue;
				}
				if (current.trim()) {
					tokens.push(current.trim());
				}
				tokens.push(ch);
				current = "";
			} else {
				current += ch;
			}
		}

		if (current.trim()) {
			tokens.push(current.trim());
		}

		return tokens;
	}

	private inferOperandType(operand: string): TypeInfo {
		// Check if it's a numeric literal
		if (/^[+-]?\d+(\.\d+)?$/.test(operand)) {
			return make("Int");
		}

		// Check if it's a string literal
		if (/^".*"$/.test(operand)) {
			return make("String");
		}

		// Check if it's a boolean literal
		if (/^(true|false)$/.test(operand)) {
			return make("Bool");
		}

		// Otherwise, look it up in the types map
		return this.types.get(operand) ?? make("Unknown");
	}

	private inferBinaryOperationType(
		leftType: TypeInfo,
		operator: string,
		rightType: TypeInfo,
	): TypeInfo {
		// Different types always return Unknown
		if (leftType.kind !== rightType.kind) {
			return make("Unknown");
		}

		// Int: supports all four operations (+, -, *, /)
		if (leftType.kind === "Int") {
			return make("Int");
		}

		// String: only supports addition (+)
		if (leftType.kind === "String") {
			if (operator === "+") {
				return make("String");
			}
			return make("Unknown");
		}

		// All other types return Unknown
		return make("Unknown");
	}
}
