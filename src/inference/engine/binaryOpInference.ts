import type { TypeInfo } from "../inference";
import { make } from "../types";
import { checkContainsUnknown, mergeTypes } from "../utils";
import type { ExpressionInference } from "./expressionInference";
import {
	type DeclarationNameAndValueMatch,
	extractDeclarationNameAndValue,
} from "./regexPatterns";

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
	 * Process a binary operation assignment.
	 * Infers the result type and updates the variable's type.
	 */
	private processBinaryOpAssignment(match: DeclarationNameAndValueMatch): void {
		const expr = match.value.trim();

		// Check if expression contains binary operators
		if (!/[+\-*/]/.test(expr)) {
			return;
		}

		// Infer the type of the entire expression
		const resultType = this.inferBinaryExpressionType(expr);
		if (resultType) {
			const existingType = this.types.get(match.name);
			if (!existingType || checkContainsUnknown(existingType)) {
				this.types.set(match.name, resultType);
			}
		}
	}

	/**
	 * Scan variable assignments containing binary operators to infer types.
	 */
	public scanBinaryOps(lines: string[]): void {
		for (const raw of lines) {
			const line = raw.trim();

			// Check if this line is a variable assignment
			const match = extractDeclarationNameAndValue(line);
			if (!match) {
				continue;
			}

			this.processBinaryOpAssignment(match);
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
		const mergedType = mergeTypes(leftType, rightType);

		if (mergedType.kind === "Unknown") {
			return make("Unknown");
		}

		if (mergedType.kind === "Int") {
			if (
				operator === "+" ||
				operator === "-" ||
				operator === "*" ||
				operator === "/"
			) {
				return make("Int");
			}
		}

		if (mergedType.kind === "String") {
			if (operator === "+") {
				return make("String");
			}
		}

		return make("Unknown");
	}
}
