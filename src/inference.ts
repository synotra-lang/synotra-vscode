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
	| "Unknown"
	| "Unit";

export interface TypeInfo {
	kind: TypeKind;
	generics?: TypeInfo[]; // e.g. List<T> -> generics = [T]
	readonlyName?: string; // optional friendly name
	hasTypeAnnotation?: boolean; // whether this type was explicitly annotated
}

function make(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
	hasTypeAnnotation?: boolean,
): TypeInfo {
	return { kind, generics, readonlyName, hasTypeAnnotation };
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
	private functionReturnTypes: Map<string, TypeInfo> = new Map();

	public inferFromText(text: string, ast: ASTNode): Map<string, TypeInfo> {
		this.types = new Map();
		this.functionReturnTypes = new Map();
		const lines = text.split(/\r?\n/);
		this.collectDeclarationsFromAST(ast);
		this.collectFunctionReturnTypes(ast, lines);
		this.scanDeclarationsWithoutInit(lines);
		this.scanInitializers(lines);
		this.scanAssignments(lines);
		this.scanCollectionUsages(lines);
		this.scanBinaryOps(lines);
		return this.types;
	}

	/**
	 * Collect function return types from AST.
	 * Parses function definitions like "fun x() -> Int" or "io fun y(a: String) -> Bool"
	 */
	private collectFunctionReturnTypes(ast: ASTNode, lines: string[]): void {
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
			return this.parseTypeString(funMatch[1].trim());
		}

		return null;
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

	/**
	 * Scan declarations with type annotation but without initialization.
	 * e.g. "var x: Int" or "val y: String"
	 */
	private scanDeclarationsWithoutInit(lines: string[]) {
		// Match: var/val identifier: Type (without = sign)
		const declRegex = /\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^=]+)$/;
		for (const raw of lines) {
			const line = raw.trim();
			const m = line.match(declRegex);
			if (!m) {
				continue;
			}

			const name = m[1];
			const annotation = m[2].trim();

			const annotatedType = this.parseTypeString(annotation);
			annotatedType.hasTypeAnnotation = true;
			this.types.set(name, annotatedType);
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
				annotatedType.hasTypeAnnotation = true;
				this.types.set(name, annotatedType);
			} else {
				const inferred = this.inferExpressionType(rhs);
				this.types.set(name, inferred);
			}
		}
	}

	/**
	 * Scan assignment statements (without var/val keyword).
	 * e.g. "x = 10" where x was declared earlier with type annotation.
	 * Note: Variables declared without type annotation (e.g. "var x") will NOT
	 * have their type inferred from later assignments. Type annotation is required
	 * for variables without initialization.
	 */
	private scanAssignments(_lines: string[]) {
		// Match: identifier = expression (but not var/val declarations)
		//const assignRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;
		// Type annotation is required for variables without initialization.
		// Do NOT infer type from later assignments - the type must be
		// explicitly annotated at declaration time.
		// If hasTypeAnnotation is false, the variable was declared without
		// a type annotation (e.g. "var x"), which is not allowed.
		// Keep the type as Unknown to indicate an error.
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

		// User-defined type constructor: ClassName.new(...) or ClassName<...>.new(...)
		const customTypeMatch = expr.match(
			/^\s*([A-Z][a-zA-Z0-9_]*)\s*(<.+>)?\s*\.new\s*\(/,
		);
		if (customTypeMatch) {
			const typeName = customTypeMatch[1];
			const genericContent = this.extractGenericContent(expr);
			if (genericContent) {
				const genericParams = this.parseCommaSeparated(genericContent);
				const generics = genericParams.map((p) => this.parseTypeString(p));
				return make("Custom", generics, typeName);
			}
			return make("Custom", undefined, typeName);
		}

		// Function call: funcName(...) - check return type from collected functions
		const funcCallMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
		if (funcCallMatch) {
			const funcName = funcCallMatch[1];
			const returnType = this.functionReturnTypes.get(funcName);
			if (returnType) {
				return returnType;
			}
		}

		// Function call or identifier
		if (/^[a-zA-Z_][a-zA-Z0-9_]*(\(.*\))?$/.test(expr)) {
			const existingType = this.types.get(expr);
			if (existingType) {
				return existingType;
			}
			return make("Unit");
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
	 * e.g. "MyClass" -> { kind: "Custom", readonlyName: "MyClass" }
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
			// For Custom types, preserve the original name
			const readonlyName = kind === "Custom" ? baseName : undefined;
			return make(kind, generics, readonlyName);
		}

		// Simple type without generics
		const kind = this.typeNameToKind(trimmed);
		// For Custom types, preserve the original name
		const readonlyName = kind === "Custom" ? trimmed : undefined;
		return make(kind, undefined, readonlyName);
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
				// User-defined types (classes, actors)
				return "Custom";
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
		if (methodMatch?.index === undefined || !methodMatch) {
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

	/**
	 * Check if a TypeInfo or any of its generics is Unknown.
	 */
	private checkContainsUnknown(t: TypeInfo): boolean {
		if (t.kind === "Unknown") {
			return true;
		}
		if (t.generics) {
			for (const g of t.generics) {
				if (this.checkContainsUnknown(g)) {
					return true;
				}
			}
		}
		return false;
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
						this.mergeCollectionElementType(call.object, elemType);
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

	/**
	 * Merge element type for List or MutableSet.
	 * Determines the collection kind based on existing type information.
	 */
	private mergeCollectionElementType(
		collectionName: string,
		elemType: TypeInfo,
	) {
		const existing = this.types.get(collectionName);

		// If existing type is MutableSet, merge as MutableSet
		if (existing?.kind === "MutableSet") {
			const cur = existing.generics?.[0] ?? make("Unknown");
			const merged = this.mergeTypes(cur, elemType);
			this.types.set(collectionName, make("MutableSet", [merged]));
			return;
		}

		// If existing type is List, merge as List
		if (existing?.kind === "List") {
			const cur = existing.generics?.[0] ?? make("Unknown");
			const merged = this.mergeTypes(cur, elemType);
			this.types.set(collectionName, make("List", [merged]));
			return;
		}

		// If no existing type or Unknown, we cannot determine the collection type
		// Leave as Unknown since add() is ambiguous between List and MutableSet
		if (!existing || this.checkContainsUnknown(existing)) {
			// Keep as Unknown - cannot determine if it's List or MutableSet from add() alone
			return;
		}
	}

	private mergeMapTypes(mapName: string, keyType: TypeInfo, valType: TypeInfo) {
		const existing = this.types.get(mapName);
		if (!existing || this.checkContainsUnknown(existing)) {
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
				const existingType = this.types.get(varName);
				if (!existingType || this.checkContainsUnknown(existingType)) {
					this.types.set(varName, resultType);
				}
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
