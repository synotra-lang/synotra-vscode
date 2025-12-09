import type { TypeInfo } from "../inference";
import { make, type TypeRegistry } from "../types";
import {
	type BuiltinCollectionConstructorMatch,
	type ConstructorMatch,
	extractBuiltinCollectionConstructor,
	extractConstructor,
	extractFunctionName,
	extractMethodCall,
	type FunctionNameMatch,
	isBoolLiteral,
	isFunctionCallOrIdentifier,
	isIntLiteral,
	isStringLiteral,
} from "./regexPatterns";
import type { TypeParser } from "./typeParser";

/**
 * Handles type inference for expressions including literals, constructors, and function calls.
 */
export class ExpressionInference {
	private functionReturnTypes: Map<string, TypeInfo>;
	private types: Map<string, TypeInfo>;
	private typeParser: TypeParser; // Reference to TypeParser instance
	private typeRegistry?: TypeRegistry; // Optional reference to TypeRegistry for method lookup

	constructor(
		functionReturnTypes: Map<string, TypeInfo>,
		types: Map<string, TypeInfo>,
		typeParser: TypeParser,
		typeRegistry?: TypeRegistry,
	) {
		this.functionReturnTypes = functionReturnTypes;
		this.types = types;
		this.typeParser = typeParser;
		this.typeRegistry = typeRegistry;
	}

	/**
	 * Process a builtin collection constructor match.
	 * e.g., List<Int>.new() -> { kind: "List", generics: [Int] }
	 */
	private processBuiltinCollectionConstructor(
		match: BuiltinCollectionConstructorMatch,
		expr: string,
	): TypeInfo {
		const kind = this.typeParser.typeNameToKind(match.collectionType);

		// Extract generic content if present
		const genericContent = this.typeParser.extractGenericContent(expr);
		if (genericContent) {
			const genericParams = this.typeParser.parseCommaSeparated(genericContent);
			const generics = genericParams.map((p: string) =>
				this.typeParser.parseTypeString(p),
			);
			const collectionKind = kind as "List" | "MutableMap" | "MutableSet";
			return make(collectionKind, generics);
		}

		// No generic parameters specified
		switch (kind) {
			case "List":
			case "MutableSet":
				return make(kind, [make("Unknown")]);
			case "MutableMap":
				return make(kind, [make("Unknown"), make("Unknown")]);
			default:
				return make("Unknown");
		}
	}

	/**
	 * Process a custom type constructor match.
	 * e.g., MyClass<Int>.new() -> { kind: "Custom", readonlyName: "MyClass", generics: [Int] }
	 */
	private processCustomTypeConstructor(
		match: ConstructorMatch,
		expr: string,
	): TypeInfo {
		const genericContent = this.typeParser.extractGenericContent(expr);
		if (genericContent) {
			const genericParams = this.typeParser.parseCommaSeparated(genericContent);
			const generics = genericParams.map((p: string) =>
				this.typeParser.parseTypeString(p),
			);
			return make("Custom", generics, match.typeName);
		}
		return make("Custom", undefined, match.typeName);
	}

	/**
	 * Process a function call match.
	 * Returns the function's return type if known.
	 */
	private processFunctionCall(match: FunctionNameMatch): TypeInfo | null {
		const returnType = this.functionReturnTypes.get(match.name);
		return returnType ?? null;
	}

	/**
	 * Process a method call on an object (e.g., "list.size()").
	 * Looks up the object's type and returns the method's return type.
	 */
	private processMethodCall(expr: string): TypeInfo | null {
		if (!this.typeRegistry) {
			return null;
		}

		const methodMatch = extractMethodCall(expr);
		if (!methodMatch) {
			return null;
		}

		// Get the type of the object
		const objectType = this.types.get(methodMatch.objectName);
		if (!objectType) {
			return null;
		}

		// Get methods for this type
		const methods = this.typeRegistry.getMethodsForType(objectType);
		for (const method of methods) {
			if (method.name === methodMatch.methodName) {
				return method.returnType;
			}
		}

		return null;
	}

	/**
	 * Infer the type of an expression.
	 * Handles string/boolean/numeric literals, collection constructors, custom types, and function calls.
	 */
	public inferExpressionType(expr: string): TypeInfo {
		// String literal
		if (isStringLiteral(expr)) {
			return make("String");
		}
		// Boolean literal
		if (isBoolLiteral(expr)) {
			return make("Bool");
		}
		// Numeric literal (integer or float) -> Int for simplicity
		if (isIntLiteral(expr)) {
			return make("Int");
		}

		// Method call: object.method()
		const methodReturnType = this.processMethodCall(expr);
		if (methodReturnType) {
			return methodReturnType;
		}

		// Collection construction: TypeName<...>.new(...)
		// Supports nested generics like List<List<Int>>.new() or Map<String, List<Int>>.new()
		const collectionMatch = extractBuiltinCollectionConstructor(expr);
		if (collectionMatch) {
			return this.processBuiltinCollectionConstructor(collectionMatch, expr);
		}

		// User-defined type constructor: ClassName.new(...) or ClassName<...>.new(...)
		const customTypeMatch = extractConstructor(expr);
		if (customTypeMatch) {
			return this.processCustomTypeConstructor(customTypeMatch, expr);
		}

		// Function call: funcName(...) - check return type from collected functions
		const funcCallMatch = extractFunctionName(expr);
		if (funcCallMatch) {
			const returnType = this.processFunctionCall(funcCallMatch);
			if (returnType) {
				return returnType;
			}
		}

		// Function call or identifier
		if (isFunctionCallOrIdentifier(expr)) {
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
	 * Infer the type of an operand (literal or variable).
	 */
	public inferOperandType(operand: string): TypeInfo {
		// Check if it's a numeric literal
		if (isIntLiteral(operand)) {
			return make("Int");
		}

		// Check if it's a string literal
		if (isStringLiteral(operand)) {
			return make("String");
		}

		// Check if it's a boolean literal
		if (isBoolLiteral(operand)) {
			return make("Bool");
		}

		// Otherwise, look it up in the types map
		return this.types.get(operand) ?? make("Unknown");
	}
}
