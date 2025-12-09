// biome-ignore assist/source/organizeImports: Because it does not disappear even after formatting
import { generic, t, type TypeDefinition } from "./types";

/**
 * Initialize built-in types with their methods
 */
export function initBuiltinTypes(): Map<string, TypeDefinition> {
	const builtinTypes = new Map<string, TypeDefinition>();

	// Int type
	builtinTypes.set("Int", {
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
	builtinTypes.set("String", {
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
	builtinTypes.set("Bool", {
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
	builtinTypes.set("List", {
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
	builtinTypes.set("MutableMap", {
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
	builtinTypes.set("MutableSet", {
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

	return builtinTypes;
}
