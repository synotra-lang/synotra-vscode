import type { TypeInfo, TypeKind } from "../inference";

function make(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
	hasTypeAnnotation?: boolean,
): TypeInfo {
	return { kind, generics, readonlyName, hasTypeAnnotation };
}

/**
 * Handles parsing of type strings and type-related operations.
 * Supports simple types, generic types, and nested generics.
 */
export class TypeParser {
	/**
	 * Parse a type string recursively, handling nested generic types.
	 * e.g. "List<Int>" -> { kind: "List", generics: [{ kind: "Int" }] }
	 * e.g. "MutableMap<String, List<Int>>" -> { kind: "MutableMap", generics: [String, List<Int>] }
	 * e.g. "MyClass" -> { kind: "Custom", readonlyName: "MyClass" }
	 */
	public parseTypeString(typeStr: string): TypeInfo {
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
	public typeNameToKind(name: string): TypeKind {
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
	 * Parse comma-separated arguments while respecting nested brackets.
	 * Supports (), [], {}, and <> for generic types.
	 * e.g. "fn(a,b), c, d" -> ["fn(a,b)", "c", "d"]
	 * e.g. "String, List<Int>" -> ["String", "List<Int>"]
	 */
	public parseCommaSeparated(argsString: string): string[] {
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
	 * Extract the content inside angle brackets from a type expression.
	 * Handles nested angle brackets correctly.
	 * e.g. "List<List<Int>>" -> "List<Int>"
	 * e.g. "Map<String, List<Int>>" -> "String, List<Int>"
	 */
	public extractGenericContent(expr: string): string | null {
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
}
