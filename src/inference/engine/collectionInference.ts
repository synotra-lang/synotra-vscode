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

interface MethodCall {
	object: string;
	method: string;
	args: string[];
}

/**
 * Handles type inference for collection operations (List, MutableMap, MutableSet).
 */
export class CollectionInference {
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
	 * Check if a TypeInfo or any of its generics is Unknown.
	 */
	public checkContainsUnknown(t: TypeInfo): boolean {
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

	/**
	 * Scan collection method calls to infer types.
	 * e.g. list.add(10) -> infer list as List<Int>
	 * e.g. map.put("key", 20) -> infer map as MutableMap<String, Int>
	 * e.g. set.add("value") -> infer set as MutableSet<String>
	 */
	public scanCollectionUsages(lines: string[]): void {
		for (const raw of lines) {
			const line = raw.trim();
			const call = this.parseMethodCall(line);

			if (!call) {
				continue;
			}

			switch (call.method) {
				case "add":
					if (call.args.length === 1) {
						const elemType = this.expressionInference.inferExpressionType(
							call.args[0],
						);
						this.mergeCollectionElementType(call.object, elemType);
					}
					break;

				case "put":
					if (call.args.length === 2) {
						const keyType = this.expressionInference.inferExpressionType(
							call.args[0],
						);
						const valType = this.expressionInference.inferExpressionType(
							call.args[1],
						);
						this.mergeMapTypes(call.object, keyType, valType);
					}
					break;
			}
		}
	}

	/**
	 * Parse a method call expression and extract object name, method name, and arguments.
	 * Handles nested parentheses correctly.
	 * e.g. "list.add(fn(1,2))" -> { object: "list", method: "add", args: ["fn(1,2)"] }
	 */
	private parseMethodCall(line: string): MethodCall | null {
		// Match pattern: identifier.identifier(
		const methodMatch = line.match(
			/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
		);
		if (methodMatch?.index === undefined || !methodMatch) {
			return null;
		}

		const object = methodMatch[1];
		const method = methodMatch[2];
		const startIndex = methodMatch.index + methodMatch[0].length;

		// Find the matching closing parenthesis
		let depth = 1;
		let endIndex = startIndex;

		for (let i = startIndex; i < line.length && depth > 0; i++) {
			const ch = line[i];
			if (ch === "(") {
				depth++;
			} else if (ch === ")") {
				depth--;
			}
			if (depth > 0) {
				endIndex = i + 1;
			}
		}

		const argsString = line.substring(startIndex, endIndex);
		const args = this.expressionInference.typeParser?.parseCommaSeparated(
			argsString,
		) || [argsString];

		return { object, method, args };
	}

	/**
	 * Merge element type for List or MutableSet.
	 * Determines the collection kind based on existing type information.
	 */
	private mergeCollectionElementType(
		collectionName: string,
		elemType: TypeInfo,
	): void {
		const existing = this.types.get(collectionName);

		// If existing type is MutableSet, merge as MutableSet
		if (existing?.kind === "MutableSet") {
			const cur = existing.generics?.[0] ?? make("Unknown");
			const merged = this.mergeTypes(cur, elemType);
			this.types.set(collectionName, make("MutableSet", [merged]));
			return;
		}

		// If existing type is List, merge as List
		if (existing?.kind === "List") {
			const cur = existing.generics?.[0] ?? make("Unknown");
			const merged = this.mergeTypes(cur, elemType);
			this.types.set(collectionName, make("List", [merged]));
			return;
		}

		// If no existing type or Unknown, we cannot determine the collection type
		// Leave as Unknown since add() is ambiguous between List and MutableSet
		if (!existing || this.checkContainsUnknown(existing)) {
			// Keep as Unknown - cannot determine if it's List or MutableSet from add() alone
			return;
		}
	}

	/**
	 * Merge types for MutableMap operations.
	 */
	private mergeMapTypes(
		mapName: string,
		keyType: TypeInfo,
		valType: TypeInfo,
	): void {
		const existing = this.types.get(mapName);
		if (!existing || this.checkContainsUnknown(existing)) {
			this.types.set(mapName, make("MutableMap", [keyType, valType]));
			return;
		}
		if (existing.kind === "MutableMap") {
			const curKey = existing.generics?.[0]
				? existing.generics[0]
				: make("Unknown");
			const curVal = existing.generics?.[1]
				? existing.generics[1]
				: make("Unknown");
			const mergedKey = this.mergeTypes(curKey, keyType);
			const mergedVal = this.mergeTypes(curVal, valType);
			this.types.set(mapName, make("MutableMap", [mergedKey, mergedVal]));
			return;
		}
	}

	/**
	 * Merge two types, preferring non-Unknown types when possible.
	 */
	public mergeTypes(a: TypeInfo, b: TypeInfo): TypeInfo {
		// Simple merge: if same kind return that, otherwise Unknown or Custom
		if (a.kind === b.kind) {
			// Merge generics recursively if present
			if (a.generics && b.generics && a.generics.length === b.generics.length) {
				const gens = a.generics.map((g, i) => {
					if (!b.generics) {
						return g;
					}
					return this.mergeTypes(g, b.generics[i]);
				});
				return make(a.kind, gens);
			}
			return a;
		}
		// If one is Unknown return the other
		if (a.kind === "Unknown") {
			return b;
		}
		if (b.kind === "Unknown") {
			return a;
		}
		return a;
	}
}
