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
		const initRegex = /\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;
		for (const raw of lines) {
			const line = raw.trim();
			const m = line.match(initRegex);
			if (!m) {
				continue;
			}
			const name = m[1];
			const rhs = m[2].trim();
			const inferred = this.inferExpressionType(rhs);
			this.types.set(name, inferred);
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
		// List/Map/Set construction
		// Extract generic type from List<T>.new(...)
		let match = expr.match(/^\s*List\s*<([^>]+)>\s*\.new\s*\(/);
		if (match?.[1]) {
			const typeParam = match[1].trim();
			return make("List", [this.parseTypeParam(typeParam)]);
		}
		if (
			/^\s*List(\s*<.*>)?\.new\s*\(/.test(expr) ||
			/^\s*List\.new\s*\(/.test(expr)
		) {
			return make("List", [make("Unknown")]);
		}
		// Extract generic types from Map<K, V>.new(...)
		match = expr.match(/^\s*MutableMap\s*<([^,]+)\s*,\s*([^>]+)>\s*\.new\s*\(/);
		if (match?.[1] && match[2]) {
			const keyType = match[1].trim();
			const valType = match[2].trim();
			return make("MutableMap", [
				this.parseTypeParam(keyType),
				this.parseTypeParam(valType),
			]);
		}
		if (
			/^\s*MutableMap(\s*<.*>)?\.new\s*\(/.test(expr) ||
			/^\s*MutableMap\.new\s*\(/.test(expr)
		) {
			return make("MutableMap", [make("Unknown"), make("Unknown")]);
		}
		// Extract generic type from Set<T>.new(...)
		match = expr.match(/^\s*MutableSet\s*<([^>]+)>\s*\.new\s*\(/);
		if (match?.[1]) {
			const typeParam = match[1].trim();
			return make("MutableSet", [this.parseTypeParam(typeParam)]);
		}
		if (
			/^\s*MutableSet(\s*<.*>)?\.new\s*\(/.test(expr) ||
			/^\s*MutableSet\.new\s*\(/.test(expr)
		) {
			return make("MutableSet", [make("Unknown")]);
		}
		// Function call or identifier -> unknown/custom
		if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.*\)$/.test(expr)) {
			return make("Unknown");
		}
		// Fallback: Unknown
		return make("Unknown");
	}

	private parseTypeParam(typeStr: string): TypeInfo {
		const trimmed = typeStr.trim();
		switch (trimmed) {
			case "Int":
				return make("Int");
			case "String":
				return make("String");
			case "Bool":
				return make("Bool");
			default:
				return make("Unknown");
		}
	}

	private scanCollectionUsages(lines: string[]) {
		// list.add(10) -> infer list as List<Int>
		// map.put("key", 20) -> infer map as Map<String, Int>
		// set.add("value") -> infer set as Set<String>
		const addRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\.add\s*\(\s*(.+?)\s*\)/;
		const putRegex =
			/([a-zA-Z_][a-zA-Z0-9_]*)\.put\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/;
		for (const raw of lines) {
			const line = raw.trim();
			let m = line.match(addRegex);
			if (m) {
				const name = m[1];
				const arg = m[2];
				const elemType = this.inferExpressionType(arg);
				this.mergeListElementType(name, elemType);
			}
			m = line.match(putRegex);
			if (m) {
				const name = m[1];
				const keyExpr = m[2];
				const valExpr = m[3];
				const keyType = this.inferExpressionType(keyExpr);
				const valType = this.inferExpressionType(valExpr);
				this.mergeMapTypes(name, keyType, valType);
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
