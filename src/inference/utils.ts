import type { TypeInfo } from "./inference";
import { make } from "./types";

/**
 * Check if a TypeInfo or any of its generics is Unknown.
 */
export function checkContainsUnknown(t: TypeInfo): boolean {
	if (t.kind === "Unknown") {
		return true;
	}
	if (t.generics) {
		for (const g of t.generics) {
			if (checkContainsUnknown(g)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Merge two types, preferring non-Unknown types when possible.
 */
export function mergeTypes(a: TypeInfo, b: TypeInfo): TypeInfo {
	// Simple merge: if same kind return that, otherwise Unknown or Custom
	if (a.kind === b.kind) {
		// Merge generics recursively if present
		if (a.generics && b.generics && a.generics.length === b.generics.length) {
			const gens = a.generics.map((g, i) => {
				if (!b.generics) {
					return g;
				}
				return mergeTypes(g, b.generics[i]);
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
