import type { TypeInfo } from "../inference";
import type { ExpressionInference } from "./expressionInference";
import type { TypeParser } from "./typeParser";

/**
 * Handles scanning and type inference for variable declarations.
 * Covers type annotations, initializers, and assignments.
 */
export class DeclarationInference {
	private types: Map<string, TypeInfo>;
	private typeParser: TypeParser;
	private expressionInference: ExpressionInference;

	constructor(
		types: Map<string, TypeInfo>,
		typeParser: TypeParser,
		expressionInference: ExpressionInference,
	) {
		this.types = types;
		this.typeParser = typeParser;
		this.expressionInference = expressionInference;
	}

	/**
	 * Scan declarations with type annotation but without initialization.
	 * e.g. "var x: Int" or "val y: String"
	 */
	public scanDeclarationsWithoutInit(lines: string[]): void {
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

			const annotatedType = this.typeParser.parseTypeString(annotation);
			annotatedType.hasTypeAnnotation = true;
			this.types.set(name, annotatedType);
		}
	}

	/**
	 * Scan variable initializers to infer types from initialization expressions.
	 * Supports both annotated and unannotated declarations.
	 * e.g. "var x: Int = 10" or "val y = List<Int>.new()"
	 */
	public scanInitializers(lines: string[]): void {
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
				const annotatedType = this.typeParser.parseTypeString(annotation);
				annotatedType.hasTypeAnnotation = true;
				this.types.set(name, annotatedType);
			} else {
				const inferred = this.expressionInference.inferExpressionType(rhs);
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
	public scanAssignments(_lines: string[]): void {
		// Match: identifier = expression (but not var/val declarations)
		//const assignRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;
		// Type annotation is required for variables without initialization.
		// Do NOT infer type from later assignments - the type must be
		// explicitly annotated at declaration time.
		// If hasTypeAnnotation is false, the variable was declared without
		// a type annotation (e.g. "var x"), which is not allowed.
		// Keep the type as Unknown to indicate an error.
	}
}
