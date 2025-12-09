import type { ASTNode } from "../core/ast";
import {
	ASTProcessor,
	BinaryOpInference,
	CollectionInference,
	DeclarationInference,
	ExpressionInference,
	type TypeParser,
} from "./engine";
import type { TypeRegistry } from "./types";

export type TypeKind =
	| "Int"
	| "String"
	| "Bool"
	| "List"
	| "MutableMap"
	| "MutableSet"
	| "Function"
	| "Custom"
	| "Unknown"
	| "Unit";

export interface TypeInfo {
	kind: TypeKind;
	generics?: TypeInfo[]; // e.g. List<T>: generics = [T]
	readonlyName?: string; // optional friendly name
	hasTypeAnnotation?: boolean; // whether this type was explicitly annotated
}

export function typeToString(t?: TypeInfo): string {
	if (!t) {
		return "Unknown";
	}
	if (!t.generics || t.generics.length === 0) {
		return t.readonlyName ?? t.kind;
	}
	const gen = t.generics.map((g) => typeToString(g)).join(", ");
	return `${t.readonlyName ?? t.kind}<${gen}>`;
}

export class InferenceEngine {
	private types: Map<string, TypeInfo> = new Map();
	private functionReturnTypes: Map<string, TypeInfo> = new Map();
	private typeParser: TypeParser;
	private expressionInference: ExpressionInference;
	private collectionInference: CollectionInference;
	private binaryOpInference: BinaryOpInference;
	private declarationInference: DeclarationInference;
	private astProcessor: ASTProcessor;
	private typeRegistry: TypeRegistry;

	constructor(typeRegistry: TypeRegistry, typeParser: TypeParser) {
		this.typeParser = typeParser;
		this.typeRegistry = typeRegistry;
		this.expressionInference = new ExpressionInference(
			this.functionReturnTypes,
			this.types,
			this.typeParser,
			this.typeRegistry,
		);
		this.collectionInference = new CollectionInference(
			this.types,
			this.expressionInference,
			this.typeParser,
		);
		this.binaryOpInference = new BinaryOpInference(
			this.types,
			this.expressionInference,
		);
		this.declarationInference = new DeclarationInference(
			this.types,
			this.typeParser,
			this.expressionInference,
		);
		this.astProcessor = new ASTProcessor(
			this.types,
			this.functionReturnTypes,
			this.typeParser,
		);
	}

	public inferFromText(text: string, ast: ASTNode): Map<string, TypeInfo> {
		this.types.clear();
		this.functionReturnTypes.clear();
		const lines = text.split(/\r?\n/);
		this.astProcessor.collectDeclarationsFromAST(ast);
		this.astProcessor.collectFunctionReturnTypes(ast, lines);
		this.declarationInference.scanDeclarationsWithoutInit(lines);
		this.declarationInference.scanInitializers(lines);
		this.declarationInference.scanAssignments(lines);
		this.collectionInference.scanCollectionUsages(lines);
		this.binaryOpInference.scanBinaryOps(lines);
		return this.types;
	}
}
