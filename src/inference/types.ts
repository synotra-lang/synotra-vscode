import type { ASTNode } from "../core/ast";
import { initBuiltinTypes } from "./builtinDefinition";
import {
	type DeclarationKeywordNameAndTypeMatch,
	extractDeclarationKeywordNameAndType,
	extractFunctionSignature,
	extractParameterNameAndType,
	type FunctionSignatureMatch,
	type ParameterNameAndTypeMatch,
} from "./engine/regexPatterns";
import { TypeParser } from "./engine/typeParser";
import type { TypeInfo, TypeKind } from "./inference";

/**
 * Method parameter information
 */
export interface ParamInfo {
	name: string;
	type: TypeInfo;
}

/**
 * Method information for a type
 */
export interface MethodInfo {
	name: string;
	returnType: TypeInfo;
	params: ParamInfo[];
	documentation?: string;
}

/**
 * Field information for a class/actor
 */
export interface FieldInfo {
	name: string;
	type: TypeInfo;
	mutable: boolean; // var = true, val = false
}

/**
 * Type definition with methods and fields
 */
export interface TypeDefinition {
	kind: TypeKind;
	name: string;
	genericParams?: string[]; // e.g., ["T"] for List<T>, ["K", "V"] for MutableMap<K, V>
	methods: MethodInfo[];
	fields: FieldInfo[];
}

// Helper to create TypeInfo
export function make(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
	hasTypeAnnotation?: boolean,
): TypeInfo {
	return { kind, generics, readonlyName, hasTypeAnnotation };
}

// Helper to create TypeInfo
export function t(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
): TypeInfo {
	return { kind, generics, readonlyName };
}

// Generic type placeholder
export function generic(name: string): TypeInfo {
	return { kind: "Unknown", readonlyName: name };
}

/**
 * TypeRegistry manages both built-in types and user-defined types.
 * Provides method/field lookup for autocomplete.
 */
export class TypeRegistry {
	private builtinTypes: Map<string, TypeDefinition> = new Map();
	private userTypes: Map<string, TypeDefinition> = new Map();
	private typeParser: TypeParser = new TypeParser();

	constructor() {
		this.builtinTypes = initBuiltinTypes();
	}

	/**
	 * Collect user-defined types (classes, actors) from AST
	 */
	public collectUserTypes(ast: ASTNode, lines: string[]): void {
		this.userTypes.clear();
		this.collectTypesRecursive(ast, lines);
	}

	private collectTypesRecursive(node: ASTNode, lines: string[]): void {
		if (node.kind === "class" || node.kind === "actor") {
			const typeDef = this.extractTypeDefinition(node, lines);
			this.userTypes.set(node.name, typeDef);
		}

		for (const child of node.children) {
			this.collectTypesRecursive(child, lines);
		}
	}

	/**
	 * Extract type definition from a class/actor AST node
	 */
	private extractTypeDefinition(
		node: ASTNode,
		lines: string[],
	): TypeDefinition {
		const methods: MethodInfo[] = [];
		const fields: FieldInfo[] = [];

		for (const child of node.children) {
			if (child.kind === "function") {
				const methodInfo = this.parseMethodFromLine(child, lines);
				if (methodInfo) {
					methods.push(methodInfo);
				}
			} else if (child.kind === "variable") {
				const fieldInfo = this.parseFieldFromLine(child, lines);
				if (fieldInfo) {
					fields.push(fieldInfo);
				}
			}
		}

		return {
			kind: "Custom",
			name: node.name,
			methods,
			fields,
		};
	}

	/**
	 * Process a function signature match into MethodInfo.
	 */
	private processFunctionSignature(
		match: FunctionSignatureMatch,
		nodeName: string,
	): MethodInfo {
		const params = this.parseParams(match.params);
		const returnType = match.returnType
			? this.typeParser.parseTypeString(match.returnType)
			: t("Unknown", undefined, "Unit");

		return {
			name: nodeName,
			returnType,
			params,
		};
	}

	/**
	 * Process a field declaration match into FieldInfo.
	 */
	private processFieldDeclaration(
		match: DeclarationKeywordNameAndTypeMatch,
		nodeName: string,
	): FieldInfo {
		const mutable = match.keyword === "var";
		const type = match.typeAnnotation
			? this.typeParser.parseTypeString(match.typeAnnotation)
			: t("Unknown");

		return {
			name: nodeName,
			type,
			mutable,
		};
	}

	/**
	 * Parse method signature from source line
	 * e.g., "fun doSomething(x: Int, y: String): Bool"
	 */
	private parseMethodFromLine(
		node: ASTNode,
		lines: string[],
	): MethodInfo | null {
		if (node.line < 0 || node.line >= lines.length) {
			return null;
		}

		const line = lines[node.line].trim();

		// Match: (io)? fun name(params) (: returnType)?
		const match = extractFunctionSignature(line);
		if (!match) {
			return {
				name: node.name,
				returnType: t("Unknown", undefined, "Unit"),
				params: [],
			};
		}

		return this.processFunctionSignature(match, node.name);
	}

	/**
	 * Parse field from source line
	 * e.g., "var count: Int" or "val name: String"
	 */
	private parseFieldFromLine(node: ASTNode, lines: string[]): FieldInfo | null {
		if (node.line < 0 || node.line >= lines.length) {
			return null;
		}

		const line = lines[node.line].trim();

		// Match: (var|val) name(: Type)?
		const match = extractDeclarationKeywordNameAndType(line);
		if (!match) {
			return {
				name: node.name,
				type: t("Unknown"),
				mutable: true,
			};
		}

		return this.processFieldDeclaration(match, node.name);
	}

	/**
	 * Process a parameter match into ParamInfo.
	 */
	private processParameter(match: ParameterNameAndTypeMatch): ParamInfo {
		return {
			name: match.name,
			type: this.typeParser.parseTypeString(match.type),
		};
	}

	/**
	 * Parse parameter list string
	 * e.g., "x: Int, y: String" -> [{ name: "x", type: Int }, { name: "y", type: String }]
	 */
	private parseParams(paramsStr: string): ParamInfo[] {
		if (!paramsStr.trim()) {
			return [];
		}

		const params: ParamInfo[] = [];
		const parts = this.typeParser.parseCommaSeparated(paramsStr);

		for (const part of parts) {
			const match = extractParameterNameAndType(part);
			if (match) {
				params.push(this.processParameter(match));
			}
		}

		return params;
	}

	/**
	 * Get methods for a given type
	 */
	public getMethodsForType(typeInfo: TypeInfo): MethodInfo[] {
		// Check built-in types first
		const builtinDef = this.builtinTypes.get(typeInfo.kind);
		if (builtinDef) {
			// Resolve generic types if present
			return this.resolveGenericMethods(builtinDef, typeInfo);
		}

		// Check user-defined types
		const typeName = typeInfo.readonlyName ?? typeInfo.kind;
		const userDef = this.userTypes.get(typeName);
		if (userDef) {
			return userDef.methods;
		}

		return [];
	}

	/**
	 * Get fields for a given type
	 */
	public getFieldsForType(typeInfo: TypeInfo): FieldInfo[] {
		const typeName = typeInfo.readonlyName ?? typeInfo.kind;
		const userDef = this.userTypes.get(typeName);
		if (userDef) {
			return userDef.fields;
		}
		return [];
	}

	/**
	 * Resolve generic type parameters in methods
	 * e.g., List<Int>.get() returns Int instead of T
	 */
	private resolveGenericMethods(
		typeDef: TypeDefinition,
		typeInfo: TypeInfo,
	): MethodInfo[] {
		if (!typeDef.genericParams || !typeInfo.generics) {
			return typeDef.methods;
		}

		// Create mapping: T -> Int, K -> String, V -> Bool, etc.
		const genericMap = new Map<string, TypeInfo>();
		for (
			let i = 0;
			i < typeDef.genericParams.length && i < typeInfo.generics.length;
			i++
		) {
			genericMap.set(typeDef.genericParams[i], typeInfo.generics[i]);
		}

		// Resolve each method's types
		return typeDef.methods.map((method) => ({
			...method,
			returnType: this.resolveGenericType(method.returnType, genericMap),
			params: method.params.map((p) => ({
				...p,
				type: this.resolveGenericType(p.type, genericMap),
			})),
		}));
	}

	/**
	 * Resolve a single generic type using the mapping
	 */
	private resolveGenericType(
		type: TypeInfo,
		genericMap: Map<string, TypeInfo>,
	): TypeInfo {
		// Check if this is a generic placeholder (e.g., T, K, V)
		if (type.readonlyName) {
			const mappedType = genericMap.get(type.readonlyName);
			if (mappedType) {
				return mappedType;
			}
		}

		// Recursively resolve generics
		if (type.generics) {
			return {
				...type,
				generics: type.generics.map((g) =>
					this.resolveGenericType(g, genericMap),
				),
			};
		}

		return type;
	}

	/**
	 * Check if a type name is a known user-defined type
	 */
	public isUserDefinedType(name: string): boolean {
		return this.userTypes.has(name);
	}

	/**
	 * Get type definition by name
	 */
	public getTypeDefinition(name: string): TypeDefinition | undefined {
		return this.builtinTypes.get(name) ?? this.userTypes.get(name);
	}
}
