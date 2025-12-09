import type { TypeInfo } from "./inference";

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
