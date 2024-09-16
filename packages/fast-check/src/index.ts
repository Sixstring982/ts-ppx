import {
  CodeGeneratorPlugin,
  EnrichedImportDeclaration,
  GeneratedFileContents,
} from "@ts-ppx/core";
import path from "path";
import {
  LiteralTypeNode,
  Node,
  PropertySignature,
  SourceFile,
  SyntaxKind,
  TypeLiteralNode,
  TypeNode,
  TypeReferenceNode,
  UnionTypeNode,
  isIdentifier,
  isLiteralTypeNode,
  isPropertySignature,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeReferenceNode,
  isUnionTypeNode,
} from "typescript";

export type FastCheckCodeGeneratorPlugin = CodeGeneratorPlugin;
export const FastCheckCodeGeneratorPlugin = {
  make: (
    params: Readonly<{
      codegenPathFromSourcePath: (filename: string) => string;
      codegenImportFromSourceImport: (filename: string) => string;
    }>,
  ): FastCheckCodeGeneratorPlugin => {
    return {
      name: "fast-check",
      codegenImportFromSourceImport: params.codegenImportFromSourceImport,
      codegenPathFromSourcePath: params.codegenPathFromSourcePath,
      generateCode,
    };
  },
} as const;

function importFilename(sourceFilename: string, targetFilename: string) {
  let p = path.relative(path.dirname(targetFilename), sourceFilename);
  if (!p.startsWith("../") || !p.startsWith("./")) {
    p = `./${p}`;
  }

  return p.replace(/.tsx?$/, "");
}

function generateCode({
  node,
  sourceFile,
  codegenImportFromSourceImport,
  codegenPathFromSourcePath,
  findImportForTypeReference,
  sourceFilename,
  targetFilename,
}: Readonly<{
  node: Node;
  sourceFile: SourceFile;
  codegenPathFromSourcePath: (filename: string) => string;
  codegenImportFromSourceImport: (filename: string) => string;
  findImportForTypeReference: (
    node: TypeReferenceNode,
  ) => EnrichedImportDeclaration | undefined;
  sourceFilename: string;
  targetFilename: string;
}>): GeneratedFileContents {
  if (!isTypeAliasDeclaration(node)) {
    throw new Error(
      "Only type aliases can leverage the fast-check ts-ppx plugin.",
    );
  }

  const context: Context = {
    codegenPathFromSourcePath,
    codegenImportFromSourceImport,
    findImportForTypeReference,
    sourceFile,
  };
  const arbitrary = Arbitraries.forTypeNode(node.type, context);

  const typeName = node.name.escapedText.toString();

  return {
    imports: [
      "import fc from 'fast-check';",
      "import { Arbitrary } from 'fast-check';",
      `import { type ${typeName} as $${typeName} } from '${importFilename(sourceFilename, targetFilename)}';`,
      ...arbitrary.imports,
    ],
    topLevelStatements: [
      `export type ${typeName} = $${typeName};`,
      [
        `export function arbitrary${typeName}(): Arbitrary<${typeName}> {`,
        `  return ${arbitrary.code};`,
        `}`,
      ].join("\n"),
    ],
  };
}

type Context = Readonly<{
  sourceFile: SourceFile;
  codegenPathFromSourcePath: (filename: string) => string;
  codegenImportFromSourceImport: (filename: string) => string;
  findImportForTypeReference: (
    node: TypeReferenceNode,
  ) => EnrichedImportDeclaration | undefined;
}>;

type GeneratedCode = Readonly<{
  code: string;
  imports: readonly string[];
}>;
const GeneratedCode = {
  mapCode: (g: GeneratedCode, f: (schema: string) => string): GeneratedCode => {
    return {
      code: f(g.code),
      imports: g.imports,
    };
  },
} as const;

const Arbitraries = {
  forPropertySignature: (n: PropertySignature, c: Context): GeneratedCode => {
    if (n.type === undefined) {
      throw new Error("Types are required for properties.");
    }

    const code = Arbitraries.forTypeNode(n.type, c);

    if (n.questionToken !== undefined) {
      return GeneratedCode.mapCode(
        code,
        (x) => `fc.oneof(fc.constant(undefined), ${x})`,
      );
    }

    return code;
  },
  forTypeNode: (n: TypeNode, c: Context): GeneratedCode => {
    switch (n.kind) {
      case SyntaxKind.TypeReference:
        if (!isTypeReferenceNode(n)) {
          throw new Error("Expected type reference!");
        }
        return Arbitraries.forTypeReference(n, c);
      case SyntaxKind.TypeLiteral:
        if (!isTypeLiteralNode(n)) throw new Error("Expected type literal!");
        return Arbitraries.forTypeLiteral(n, c);
      case SyntaxKind.LiteralType:
        if (!isLiteralTypeNode(n)) throw new Error("Expected literal type!");
        return Arbitraries.forLiteral(n.literal, c);
      case SyntaxKind.BigIntKeyword:
        return Arbitraries.forBigIntKeyword(n, c);
      case SyntaxKind.StringKeyword:
        return Arbitraries.forStringKeyword(n, c);
      case SyntaxKind.NumberKeyword:
        return Arbitraries.forNumberKeyword(n, c);
      case SyntaxKind.UndefinedKeyword:
        return Arbitraries.forUndefinedKeyword(n, c);
      case SyntaxKind.UnionType:
        if (!isUnionTypeNode(n)) throw new Error("Expected union type!");
        return Arbitraries.forUnion(n, c);
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forTypeLiteral: (n: TypeLiteralNode, c: Context): GeneratedCode => {
    const lines: string[] = ["fc.record({"];
    const imports: string[] = [];

    n.forEachChild((child: Node) => {
      switch (child.kind) {
        case SyntaxKind.PropertySignature:
          if (!isPropertySignature(child)) {
            throw new Error("Expected property signature!");
          }
          if (!isIdentifier(child.name)) {
            throw new Error("Expected property name to be an identifier!");
          }
          const code = Arbitraries.forPropertySignature(child, c);
          lines.push(`  ${child.name.escapedText}: ${code.code},`);
          imports.push(...code.imports);
          return;
      }
      throw new Error(`Unhandled TypeLiteral child: ${SyntaxKind[child.kind]}`);
    });

    lines.push("})");

    return {
      code: lines.join("\n"),
      imports,
    };
  },
  forLiteral: (n: LiteralTypeNode["literal"], _c: Context): GeneratedCode => {
    switch (n.kind) {
      case SyntaxKind.StringLiteral:
        return { code: `fc.constant('${n.text}')`, imports: [] };
      case SyntaxKind.NumericLiteral:
        return { code: `fc.constant(${n.text})`, imports: [] };
      case SyntaxKind.BigIntLiteral:
        return { code: `fc.constant(${n.text})`, imports: [] };
      case SyntaxKind.TrueKeyword:
        return { code: `fc.constant(true)`, imports: [] };
      case SyntaxKind.FalseKeyword:
        return { code: `fc.constant(false)`, imports: [] };
      case SyntaxKind.NullKeyword:
        return { code: `fc.constant(null)`, imports: [] };
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forStringKeyword: (_: TypeNode, _c: Context): GeneratedCode => ({
    code: "fc.string()",
    imports: [],
  }),
  forBigIntKeyword: (_: TypeNode, _c: Context): GeneratedCode => ({
    code: "fc.bigint()",
    imports: [],
  }),
  forNumberKeyword: (_: TypeNode, _c: Context): GeneratedCode => ({
    code: "fc.double()",
    imports: [],
  }),
  forUndefinedKeyword: (_: TypeNode, _c: Context): GeneratedCode => ({
    code: "fc.constant(undefined)",
    imports: [],
  }),
  forTypeReference: (n: TypeReferenceNode, c: Context): GeneratedCode => {
    if (!isIdentifier(n.typeName)) {
      throw new Error("Expected TypeReferenceNode to have an identifier!");
    }
    switch (n.typeName.escapedText) {
      case "Readonly": {
        const arg = n.typeArguments?.[0];
        if (arg === undefined) {
          throw new Error("Expected Readonly type to have an argument!");
        }
        return Arbitraries.forTypeNode(arg, c);
      }
    }
    const importDeclaration = c.findImportForTypeReference(n);
    if (importDeclaration === undefined) {
      return { code: `arbitrary${n.typeName.escapedText}()`, imports: [] };
    }

    return {
      code: `arbitrary${n.typeName.escapedText}()`,
      imports: [
        `import { arbitrary${n.typeName.escapedText} } from ${c.codegenImportFromSourceImport(importDeclaration.importFilename)}`,
      ],
    };
  },
  forUnion: (n: UnionTypeNode, c: Context): GeneratedCode => {
    const children: GeneratedCode[] = [];
    for (const child of n.types) {
      children.push(Arbitraries.forTypeNode(child, c));
    }

    return {
      code: `fc.oneof(${children.map((x) => x.code).join(", ")})`,
      imports: children.flatMap((x) => x.imports),
    };
  },
} as const;
