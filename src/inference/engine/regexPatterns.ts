// ============================================================================
// Regex Patterns - centralized regular expression definitions
// ============================================================================

export const RegexPatterns = {
	DECLARATION: {
		NAME_AND_VALUE_ONLY: /\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)/,
		NAME_AND_TYPE_WITHOUT_VALUE:
			/\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^=]+)$/,
		NAME_VALUE_AND_OPTIONAL_TYPE:
			/\b(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::\s*(.+?))?\s*=\s*(.+)$/,
		KEYWORD_AND_NAME: /\b(var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
		KEYWORD_NAME_AND_OPTIONAL_TYPE:
			/\b(var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?/,
		NAME_WITH_ASSIGN_OR_TYPE_AT_LINE_START:
			/^\s*(?:var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:)/,
	},
	FUNCTION: {
		RETURN_TYPE: /fun\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:\s*(.+?)\s*\{?$/,
		NAME: /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
		NAME_WITH_OPTIONAL_IO: /(?:io\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
		NAME_PARAMS_AND_OPTIONAL_RETURN:
			/(?:io\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)(?:\s*:\s*([^{\s]+))?/,
		ARGUMENTS_WITH_EOL: /^[a-zA-Z_][a-zA-Z0-9_]*(\(.*\))?$/,
	},
	METHOD: {
		OBJECT_AND_METHOD_NAME:
			/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
	},
	PARAMETER: {
		ARGUMENT_NAME_IN_SIGNATURE: /(?<=[(,]\s*)[a-zA-Z_][a-zA-Z0-9_]*(?=\s*:)/g,
		NAME_AND_TYPE: /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)/,
	},
	OTHER: {
		CONSTRUCTOR_NAME_AND_OPTIONAL_TYPE:
			/^\s*([A-Z][a-zA-Z0-9_]*)\s*(<.+>)?\s*\.new\s*\(/,
		TYPE_NAME_AND_GENERIC_CONTENT: /^([a-zA-Z_][a-zA-Z0-9_]*)\s*<(.+)>$/,
		BUILTIN_COLLECTION_CONSTRUCTOR_NAME_AND_OPTIONAL_TYPE:
			/^\s*(List|MutableMap|MutableSet)\s*(<.+>)?\s*\.new\s*\(/,
	},
	BUILTIN_TYPES: {
		STRING: /^".*"$/,
		BOOL: /^(true|false)$/,
		NUMBER: /^[+-]?\d+(\.\d+)?$/,
		CLASS_NAME: /\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
		ACTOR_NAME: /\bactor\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
	},
} as const;

// ============================================================================
// Match Interfaces - type-safe extraction results
// ============================================================================

/** Result of matching a variable declaration with name and value only */
export interface DeclarationNameAndValueMatch {
	name: string;
	value: string;
}

/** Result of matching a variable declaration with type annotation but no value */
export interface DeclarationNameAndTypeMatch {
	name: string;
	typeAnnotation: string;
}

/** Result of matching a variable declaration with name, optional type, and value */
export interface DeclarationWithOptionalTypeMatch {
	name: string;
	typeAnnotation: string | undefined;
	value: string;
}

/** Result of matching a variable declaration keyword and name */
export interface DeclarationKeywordAndNameMatch {
	keyword: "var" | "val";
	name: string;
}

/** Result of matching a variable declaration with keyword, name, and optional type */
export interface DeclarationKeywordNameAndTypeMatch {
	keyword: "var" | "val";
	name: string;
	typeAnnotation: string | undefined;
}

/** Result of matching a variable name at line start */
export interface DeclarationNameAtLineStartMatch {
	name: string;
}

/** Result of matching a function return type */
export interface FunctionReturnTypeMatch {
	returnType: string;
}

/** Result of matching a function name */
export interface FunctionNameMatch {
	name: string;
}

/** Result of matching a function with optional io modifier */
export interface FunctionNameWithOptionalIoMatch {
	name: string;
}

/** Result of matching a function with name, params, and optional return type */
export interface FunctionSignatureMatch {
	name: string;
	params: string;
	returnType: string | undefined;
}

/** Result of matching a method call on an object */
export interface MethodCallMatch {
	objectName: string;
	methodName: string;
}

/** Result of matching a parameter with name and type */
export interface ParameterNameAndTypeMatch {
	name: string;
	type: string;
}

/** Result of matching a constructor call */
export interface ConstructorMatch {
	typeName: string;
	genericContent: string | undefined;
}

/** Result of matching a builtin collection constructor */
export interface BuiltinCollectionConstructorMatch {
	collectionType: "List" | "MutableMap" | "MutableSet";
	genericContent: string | undefined;
}

/** Result of matching a generic type */
export interface GenericTypeMatch {
	baseName: string;
	genericContent: string;
}

/** Result of matching a class definition */
export interface ClassNameMatch {
	name: string;
}

/** Result of matching an actor definition */
export interface ActorNameMatch {
	name: string;
}

// ============================================================================
// Extract Functions - type-safe match result extraction
// ============================================================================

/**
 * Extract variable name and value from a declaration.
 * e.g., "var x = 10" -> { name: "x", value: "10" }
 */
export function extractDeclarationNameAndValue(
	line: string,
): DeclarationNameAndValueMatch | null {
	const match = line.match(RegexPatterns.DECLARATION.NAME_AND_VALUE_ONLY);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
		value: match[2],
	};
}

/**
 * Extract variable name and type annotation from a declaration without value.
 * e.g., "var x: Int" -> { name: "x", typeAnnotation: "Int" }
 */
export function extractDeclarationNameAndType(
	line: string,
): DeclarationNameAndTypeMatch | null {
	const match = line.match(
		RegexPatterns.DECLARATION.NAME_AND_TYPE_WITHOUT_VALUE,
	);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
		typeAnnotation: match[2].trim(),
	};
}

/**
 * Extract variable name, optional type annotation, and value from a declaration.
 * e.g., "var x: Int = 10" -> { name: "x", typeAnnotation: "Int", value: "10" }
 * e.g., "var y = 20" -> { name: "y", typeAnnotation: undefined, value: "20" }
 */
export function extractDeclarationWithOptionalType(
	line: string,
): DeclarationWithOptionalTypeMatch | null {
	const match = line.match(
		RegexPatterns.DECLARATION.NAME_VALUE_AND_OPTIONAL_TYPE,
	);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
		typeAnnotation: match[2]?.trim(),
		value: match[3].trim(),
	};
}

/**
 * Extract keyword (var/val) and name from a declaration.
 * e.g., "var x = 10" -> { keyword: "var", name: "x" }
 */
export function extractDeclarationKeywordAndName(
	line: string,
): DeclarationKeywordAndNameMatch | null {
	const match = line.match(RegexPatterns.DECLARATION.KEYWORD_AND_NAME);
	if (!match) {
		return null;
	}
	return {
		keyword: match[1] as "var" | "val",
		name: match[2],
	};
}

/**
 * Extract keyword, name, and optional type from a declaration.
 * e.g., "var x: Int" -> { keyword: "var", name: "x", typeAnnotation: "Int" }
 */
export function extractDeclarationKeywordNameAndType(
	line: string,
): DeclarationKeywordNameAndTypeMatch | null {
	const match = line.match(
		RegexPatterns.DECLARATION.KEYWORD_NAME_AND_OPTIONAL_TYPE,
	);
	if (!match) {
		return null;
	}
	return {
		keyword: match[1] as "var" | "val",
		name: match[2],
		typeAnnotation: match[3]?.trim(),
	};
}

/**
 * Extract variable name from a declaration at line start.
 * e.g., "  var x = 10" -> { name: "x" }
 */
export function extractDeclarationNameAtLineStart(
	line: string,
): DeclarationNameAtLineStartMatch | null {
	const match = line.match(
		RegexPatterns.DECLARATION.NAME_WITH_ASSIGN_OR_TYPE_AT_LINE_START,
	);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
	};
}

/**
 * Extract return type from a function definition.
 * e.g., "fun foo(): Int {" -> { returnType: "Int" }
 */
export function extractFunctionReturnType(
	line: string,
): FunctionReturnTypeMatch | null {
	const match = line.match(RegexPatterns.FUNCTION.RETURN_TYPE);
	if (!match) {
		return null;
	}
	return {
		returnType: match[1].trim(),
	};
}

/**
 * Extract function name from a call expression.
 * e.g., "foo(1, 2)" -> { name: "foo" }
 */
export function extractFunctionName(expr: string): FunctionNameMatch | null {
	const match = expr.match(RegexPatterns.FUNCTION.NAME);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
	};
}

/**
 * Extract function name from a definition (with optional io modifier).
 * e.g., "io fun foo()" -> { name: "foo" }
 */
export function extractFunctionNameWithOptionalIo(
	line: string,
): FunctionNameWithOptionalIoMatch | null {
	const match = line.match(RegexPatterns.FUNCTION.NAME_WITH_OPTIONAL_IO);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
	};
}

/**
 * Extract function signature (name, params, optional return type).
 * e.g., "fun foo(x: Int): Bool" -> { name: "foo", params: "x: Int", returnType: "Bool" }
 */
export function extractFunctionSignature(
	line: string,
): FunctionSignatureMatch | null {
	const match = line.match(
		RegexPatterns.FUNCTION.NAME_PARAMS_AND_OPTIONAL_RETURN,
	);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
		params: match[2],
		returnType: match[3]?.trim(),
	};
}

/**
 * Extract object name and method name from a method call.
 * e.g., "list.add(10)" -> { objectName: "list", methodName: "add" }
 */
export function extractMethodCall(line: string): MethodCallMatch | null {
	const match = line.match(RegexPatterns.METHOD.OBJECT_AND_METHOD_NAME);
	if (!match) {
		return null;
	}
	return {
		objectName: match[1],
		methodName: match[2],
	};
}

/**
 * Extract parameter name and type.
 * e.g., "x: Int" -> { name: "x", type: "Int" }
 */
export function extractParameterNameAndType(
	param: string,
): ParameterNameAndTypeMatch | null {
	const match = param.match(RegexPatterns.PARAMETER.NAME_AND_TYPE);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
		type: match[2].trim(),
	};
}

/**
 * Extract constructor type name and optional generic content.
 * e.g., "MyClass<Int>.new()" -> { typeName: "MyClass", genericContent: "<Int>" }
 */
export function extractConstructor(expr: string): ConstructorMatch | null {
	const match = expr.match(
		RegexPatterns.OTHER.CONSTRUCTOR_NAME_AND_OPTIONAL_TYPE,
	);
	if (!match) {
		return null;
	}
	return {
		typeName: match[1],
		genericContent: match[2],
	};
}

/**
 * Extract builtin collection constructor.
 * e.g., "List<Int>.new()" -> { collectionType: "List", genericContent: "<Int>" }
 */
export function extractBuiltinCollectionConstructor(
	expr: string,
): BuiltinCollectionConstructorMatch | null {
	const match = expr.match(
		RegexPatterns.OTHER.BUILTIN_COLLECTION_CONSTRUCTOR_NAME_AND_OPTIONAL_TYPE,
	);
	if (!match) {
		return null;
	}
	return {
		collectionType: match[1] as "List" | "MutableMap" | "MutableSet",
		genericContent: match[2],
	};
}

/**
 * Extract base name and generic content from a generic type.
 * e.g., "List<Int>" -> { baseName: "List", genericContent: "Int" }
 */
export function extractGenericType(typeStr: string): GenericTypeMatch | null {
	const match = typeStr.match(
		RegexPatterns.OTHER.TYPE_NAME_AND_GENERIC_CONTENT,
	);
	if (!match) {
		return null;
	}
	return {
		baseName: match[1],
		genericContent: match[2],
	};
}

/**
 * Extract class name from a class definition.
 * e.g., "class MyClass {" -> { name: "MyClass" }
 */
export function extractClassName(line: string): ClassNameMatch | null {
	const match = line.match(RegexPatterns.BUILTIN_TYPES.CLASS_NAME);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
	};
}

/**
 * Extract actor name from an actor definition.
 * e.g., "actor MyActor {" -> { name: "MyActor" }
 */
export function extractActorName(line: string): ActorNameMatch | null {
	const match = line.match(RegexPatterns.BUILTIN_TYPES.ACTOR_NAME);
	if (!match) {
		return null;
	}
	return {
		name: match[1],
	};
}

// ============================================================================
// Type Check Functions - literal type detection
// ============================================================================

/**
 * Check if an expression is a string literal.
 */
export function isStringLiteral(expr: string): boolean {
	return RegexPatterns.BUILTIN_TYPES.STRING.test(expr);
}

/**
 * Check if an expression is a boolean literal.
 */
export function isBoolLiteral(expr: string): boolean {
	return RegexPatterns.BUILTIN_TYPES.BOOL.test(expr);
}

/**
 * Check if an expression is an integer literal.
 */
export function isIntLiteral(expr: string): boolean {
	return RegexPatterns.BUILTIN_TYPES.NUMBER.test(expr);
}

/**
 * Check if an expression matches a function call or identifier with optional arguments.
 */
export function isFunctionCallOrIdentifier(expr: string): boolean {
	return RegexPatterns.FUNCTION.ARGUMENTS_WITH_EOL.test(expr);
}
