import type { TypeInfo } from "../inference";
import type { ExpressionInference } from "./expressionInference";

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
 * Handles type inference for binary operations (arithmetic and string concatenation).
 */
export class BinaryOpInference {
	private types: Map<string, TypeInfo>;
	private expressionInference: ExpressionInference;

	constructor(
		types: Map<string, TypeInfo>,
		expressionInference: ExpressionInference,
	) {
		this.types = types;
		this.expressionInference = expressionInference;
	}

	/**
	 * Scan variable assignments containing binary operators to infer types.
	 */
	public scanBinaryOps(lines: string[]): void {
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

	/**
	 * Infer the type of a binary expression by tokenizing and processing operators.
	 */
	private inferBinaryExpressionType(expr: string): TypeInfo | null {
		// Tokenize the expression into operands and operators
		const tokens = this.tokenizeExpression(expr);
		if (tokens.length === 0) {
			return null;
		}

		// If single token, infer its type directly
		if (tokens.length === 1) {
			return this.expressionInference.inferOperandType(tokens[0]);
		}

		// Process left to right: accumulate result type through operators
		let resultType = this.expressionInference.inferOperandType(tokens[0]);

		for (let i = 1; i < tokens.length; i += 2) {
			if (i + 1 >= tokens.length) {
				break; // incomplete expression
			}

			const operator = tokens[i];
			const rightOperand = tokens[i + 1];
			const rightType = this.expressionInference.inferOperandType(rightOperand);

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

	/**
	 * Split an expression into tokens (operands and operators) while respecting parentheses.
	 * e.g. "a + b - c" -> ["a", "+", "b", "-", "c"]
	 * e.g. "-5 + 10" -> ["-5", "+", "10"]
	 */
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

	/**
	 * Infer the result type of a binary operation based on operand types and operator.
	 */
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
}
