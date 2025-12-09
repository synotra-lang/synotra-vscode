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
	 * Try to infer type as a literal (string, boolean, number).
	 */
	public tryInferAsLiteral(expr: string): TypeInfo | null {
		if (isStringLiteral(expr)) {
			return make("String");
		}
		if (isBoolLiteral(expr)) {
			return make("Bool");
		}
		if (isIntLiteral(expr)) {
			return make("Int");
		}
		return null;
	}

	/**
	 * Infer the type of an expression.
	 * Handles string/boolean/numeric literals, collection constructors, custom types, and function calls.
	 */
	public inferExpressionType(expr: string): TypeInfo {
		const strategies = [
			this.tryInferAsLiteral.bind(this),
			this.tryInferAsMethodCall.bind(this),
			this.tryInferAsBuiltinCollectionConstructor.bind(this),
			this.tryInferAsCustomTypeConstructor.bind(this),
			this.tryInferAsFunctionCall.bind(this),
			this.tryInferAsIdentifier.bind(this),
		];

		for (const strategy of strategies) {
			const result = strategy(expr);
			if (result !== null) {
				return result;
			}
		}

		// Default to Unknown if no strategy matched
		return make("Unknown");
	}

	/**
	 * Try to infer type as a method call (e.g., "list.size()").
	 */
	private tryInferAsMethodCall(expr: string): TypeInfo | null {
		return this.processMethodCall(expr);
	}

	/**
	 * Try to infer type as a builtin collection constructor
	 * e.g., "List<Int>.new()" or "MutableMap<String, Bool>.new()" or "MutableSet.new()"
	 */
	private tryInferAsBuiltinCollectionConstructor(
		expr: string,
	): TypeInfo | null {
		const collectionMatch = extractBuiltinCollectionConstructor(expr);
		if (!collectionMatch) {
			return null;
		}
		return this.processBuiltinCollectionConstructor(collectionMatch, expr);
	}

	/**
	 * Try to infer type as a custom type constructor
	 * e.g., "MyClass.new()" or "MyClass<Int>.new()"
	 */
	private tryInferAsCustomTypeConstructor(expr: string): TypeInfo | null {
		const customTypeMatch = extractConstructor(expr);
		if (!customTypeMatch) {
			return null;
		}
		return this.processCustomTypeConstructor(customTypeMatch, expr);
	}

	/**
	 * Try to infer type as a function call
	 * e.g., "functionName()"
	 */
	private tryInferAsFunctionCall(expr: string): TypeInfo | null {
		const funcCallMatch = extractFunctionName(expr);
		if (!funcCallMatch) {
			return null;
		}
		return this.processFunctionCall(funcCallMatch);
	}

	/**
	 * Try to infer as an identifier or function call/identifier
	 */
	private tryInferAsIdentifier(expr: string): TypeInfo | null {
		if (!isFunctionCallOrIdentifier(expr)) {
			return null;
		}
		const existingType = this.types.get(expr);
		if (existingType) {
			return existingType;
		}
		return make("Unit");
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
