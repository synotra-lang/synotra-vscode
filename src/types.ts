import type { ASTNode } from "./ast";
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
function t(
	kind: TypeKind,
	generics?: TypeInfo[],
	readonlyName?: string,
): TypeInfo {
	return { kind, generics, readonlyName };
}

// Generic type placeholder
function generic(name: string): TypeInfo {
	return { kind: "Unknown", readonlyName: name };
}

/**
 * TypeRegistry manages both built-in types and user-defined types.
 * Provides method/field lookup for autocomplete.
 */
export class TypeRegistry {
	private builtinTypes: Map<string, TypeDefinition> = new Map();
	private userTypes: Map<string, TypeDefinition> = new Map();

	constructor() {
		this.initBuiltinTypes();
	}

	/**
	 * Initialize built-in types with their methods
	 */
	private initBuiltinTypes(): void {
		// Int type
		this.builtinTypes.set("Int", {
			kind: "Int",
			name: "Int",
			methods: [
				{
					name: "toString",
					returnType: t("String"),
					params: [],
					documentation: "Convert to string",
				},
				{
					name: "abs",
					returnType: t("Int"),
					params: [],
					documentation: "Absolute value",
				},
			],
			fields: [],
		});

		// String type
		this.builtinTypes.set("String", {
			kind: "String",
			name: "String",
			methods: [
				{
					name: "length",
					returnType: t("Int"),
					params: [],
					documentation: "Get string length",
				},
				{
					name: "substring",
					returnType: t("String"),
					params: [
						{ name: "start", type: t("Int") },
						{ name: "end", type: t("Int") },
					],
					documentation: "Get substring from start to end",
				},
				{
					name: "toUpperCase",
					returnType: t("String"),
					params: [],
					documentation: "Convert to uppercase",
				},
				{
					name: "toLowerCase",
					returnType: t("String"),
					params: [],
					documentation: "Convert to lowercase",
				},
				{
					name: "contains",
					returnType: t("Bool"),
					params: [{ name: "str", type: t("String") }],
					documentation: "Check if string contains substring",
				},
				{
					name: "startsWith",
					returnType: t("Bool"),
					params: [{ name: "prefix", type: t("String") }],
					documentation: "Check if string starts with prefix",
				},
				{
					name: "endsWith",
					returnType: t("Bool"),
					params: [{ name: "suffix", type: t("String") }],
					documentation: "Check if string ends with suffix",
				},
				{
					name: "trim",
					returnType: t("String"),
					params: [],
					documentation: "Remove leading and trailing whitespace",
				},
				{
					name: "split",
					returnType: t("List", [t("String")]),
					params: [{ name: "delimiter", type: t("String") }],
					documentation: "Split string by delimiter",
				},
				{
					name: "replace",
					returnType: t("String"),
					params: [
						{ name: "old", type: t("String") },
						{ name: "new", type: t("String") },
					],
					documentation: "Replace occurrences of old with new",
				},
				{
					name: "charAt",
					returnType: t("String"),
					params: [{ name: "index", type: t("Int") }],
					documentation: "Get character at index",
				},
				{
					name: "indexOf",
					returnType: t("Int"),
					params: [{ name: "str", type: t("String") }],
					documentation: "Find index of substring",
				},
			],
			fields: [],
		});

		// Bool type
		this.builtinTypes.set("Bool", {
			kind: "Bool",
			name: "Bool",
			methods: [
				{
					name: "toString",
					returnType: t("String"),
					params: [],
					documentation: "Convert to string",
				},
			],
			fields: [],
		});

		// List<T> type
		this.builtinTypes.set("List", {
			kind: "List",
			name: "List",
			genericParams: ["T"],
			methods: [
				{
					name: "add",
					returnType: t("Unknown", undefined, "Unit"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Add element to list",
				},
				{
					name: "get",
					returnType: generic("T"),
					params: [{ name: "index", type: t("Int") }],
					documentation: "Get element at index",
				},
				{
					name: "set",
					returnType: t("Unknown", undefined, "Unit"),
					params: [
						{ name: "index", type: t("Int") },
						{ name: "element", type: generic("T") },
					],
					documentation: "Set element at index",
				},
				{
					name: "remove",
					returnType: t("Bool"),
					params: [{ name: "index", type: t("Int") }],
					documentation: "Remove element at index",
				},
				{
					name: "size",
					returnType: t("Int"),
					params: [],
					documentation: "Get list size",
				},
				{
					name: "isEmpty",
					returnType: t("Bool"),
					params: [],
					documentation: "Check if list is empty",
				},
				{
					name: "contains",
					returnType: t("Bool"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Check if list contains element",
				},
				{
					name: "indexOf",
					returnType: t("Int"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Find index of element",
				},
				{
					name: "clear",
					returnType: t("Unknown", undefined, "Unit"),
					params: [],
					documentation: "Remove all elements",
				},
				{
					name: "first",
					returnType: generic("T"),
					params: [],
					documentation: "Get first element",
				},
				{
					name: "last",
					returnType: generic("T"),
					params: [],
					documentation: "Get last element",
				},
			],
			fields: [],
		});

		// MutableMap<K, V> type
		this.builtinTypes.set("MutableMap", {
			kind: "MutableMap",
			name: "MutableMap",
			genericParams: ["K", "V"],
			methods: [
				{
					name: "put",
					returnType: t("Unknown", undefined, "Unit"),
					params: [
						{ name: "key", type: generic("K") },
						{ name: "value", type: generic("V") },
					],
					documentation: "Put key-value pair",
				},
				{
					name: "get",
					returnType: generic("V"),
					params: [{ name: "key", type: generic("K") }],
					documentation: "Get value by key",
				},
				{
					name: "remove",
					returnType: t("Bool"),
					params: [{ name: "key", type: generic("K") }],
					documentation: "Remove entry by key",
				},
				{
					name: "containsKey",
					returnType: t("Bool"),
					params: [{ name: "key", type: generic("K") }],
					documentation: "Check if map contains key",
				},
				{
					name: "containsValue",
					returnType: t("Bool"),
					params: [{ name: "value", type: generic("V") }],
					documentation: "Check if map contains value",
				},
				{
					name: "keys",
					returnType: t("List", [generic("K")]),
					params: [],
					documentation: "Get all keys",
				},
				{
					name: "values",
					returnType: t("List", [generic("V")]),
					params: [],
					documentation: "Get all values",
				},
				{
					name: "size",
					returnType: t("Int"),
					params: [],
					documentation: "Get map size",
				},
				{
					name: "isEmpty",
					returnType: t("Bool"),
					params: [],
					documentation: "Check if map is empty",
				},
				{
					name: "clear",
					returnType: t("Unknown", undefined, "Unit"),
					params: [],
					documentation: "Remove all entries",
				},
			],
			fields: [],
		});

		// MutableSet<T> type
		this.builtinTypes.set("MutableSet", {
			kind: "MutableSet",
			name: "MutableSet",
			genericParams: ["T"],
			methods: [
				{
					name: "add",
					returnType: t("Bool"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Add element to set",
				},
				{
					name: "remove",
					returnType: t("Bool"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Remove element from set",
				},
				{
					name: "contains",
					returnType: t("Bool"),
					params: [{ name: "element", type: generic("T") }],
					documentation: "Check if set contains element",
				},
				{
					name: "size",
					returnType: t("Int"),
					params: [],
					documentation: "Get set size",
				},
				{
					name: "isEmpty",
					returnType: t("Bool"),
					params: [],
					documentation: "Check if set is empty",
				},
				{
					name: "clear",
					returnType: t("Unknown", undefined, "Unit"),
					params: [],
					documentation: "Remove all elements",
				},
			],
			fields: [],
		});
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
	 * Parse method signature from source line
	 * e.g., "fun doSomething(x: Int, y: String) -> Bool"
	 */
	private parseMethodFromLine(
		node: ASTNode,
		lines: string[],
	): MethodInfo | null {
		if (node.line < 0 || node.line >= lines.length) {
			return null;
		}

		const line = lines[node.line].trim();

		// Match: (io)? fun name(params) (-> returnType)?
		const funMatch = line.match(
			/(?:io\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)(?:\s*->\s*(.+))?/,
		);
		if (!funMatch) {
			return {
				name: node.name,
				returnType: t("Unknown", undefined, "Unit"),
				params: [],
			};
		}

		const params = this.parseParams(funMatch[2]);
		const returnType = funMatch[3]
			? this.parseTypeString(funMatch[3].trim())
			: t("Unknown", undefined, "Unit");

		return {
			name: node.name,
			returnType,
			params,
		};
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
		const varMatch = line.match(
			/\b(var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?/,
		);
		if (!varMatch) {
			return {
				name: node.name,
				type: t("Unknown"),
				mutable: true,
			};
		}

		const mutable = varMatch[1] === "var";
		const type = varMatch[3]
			? this.parseTypeString(varMatch[3].trim())
			: t("Unknown");

		return {
			name: node.name,
			type,
			mutable,
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
		const parts = this.parseCommaSeparated(paramsStr);

		for (const part of parts) {
			const paramMatch = part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)/);
			if (paramMatch) {
				params.push({
					name: paramMatch[1],
					type: this.parseTypeString(paramMatch[2].trim()),
				});
			}
		}

		return params;
	}

	/**
	 * Parse comma-separated items respecting nested brackets
	 */
	private parseCommaSeparated(str: string): string[] {
		const items: string[] = [];
		let current = "";
		let depth = 0;

		for (const ch of str) {
			if (ch === "(" || ch === "[" || ch === "{" || ch === "<") {
				depth++;
				current += ch;
			} else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") {
				depth--;
				current += ch;
			} else if (ch === "," && depth === 0) {
				items.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}

		if (current.trim()) {
			items.push(current.trim());
		}

		return items;
	}

	/**
	 * Parse type string to TypeInfo
	 */
	private parseTypeString(typeStr: string): TypeInfo {
		const trimmed = typeStr.trim();

		// Check for generic type: TypeName<...>
		const genericMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*<(.+)>$/);
		if (genericMatch) {
			const baseName = genericMatch[1];
			const genericsStr = genericMatch[2];
			const genericParams = this.parseCommaSeparated(genericsStr);
			const generics = genericParams.map((p) => this.parseTypeString(p));
			const kind = this.typeNameToKind(baseName);
			return t(kind, generics, kind === "Custom" ? baseName : undefined);
		}

		const kind = this.typeNameToKind(trimmed);
		return t(kind, undefined, kind === "Custom" ? trimmed : undefined);
	}

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
				return "Custom";
		}
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
		if (type.readonlyName && genericMap.has(type.readonlyName)) {
			return genericMap.get(type.readonlyName)!;
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
