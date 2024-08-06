import { CodeGeneratorPlugin, GeneratedFileContents } from "@ts-ppx/core";
import path from "path";
import {
  LiteralTypeNode,
  Node,
  PropertySignature,
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
      transformPath: (filename: string) => string;
    }>,
  ): FastCheckCodeGeneratorPlugin => {
    return {
      name: "fast-check",
      transformPath: params.transformPath,
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
  sourceFilename,
  targetFilename,
}: Readonly<{
  node: Node;
  sourceFilename: string;
  targetFilename: string;
}>): GeneratedFileContents {
  if (!isTypeAliasDeclaration(node)) {
    throw new Error(
      "Only type aliases can leverage the fast-check ts-ppx plugin.",
    );
  }

  const arbitrary = Arbitraries.forTypeNode(node.type);

  const typeName = node.name.escapedText.toString();

  return {
    imports: [
      "import fc from 'fast-check';",
      "import { Arbitrary } from 'fast-check';",
      `import { type ${typeName} as $${typeName} } from '${importFilename(sourceFilename, targetFilename)}';`,
    ],
    topLevelStatements: [
      `export type ${typeName} = $${typeName};`,
      [
        `export function arbitrary${typeName}(): Arbitrary<${typeName}> {`,
        `  return ${arbitrary};`,
        `}`,
      ].join("\n"),
    ],
  };
}

const Arbitraries = {
  forPropertySignature: (n: PropertySignature): string => {
    if (n.type === undefined) {
      throw new Error("Types are required for properties.");
    }

    const schema = Arbitraries.forTypeNode(n.type);

    if (n.questionToken !== undefined) {
      return `fc.oneof(fc.constant(undefined), ${schema})`;
    }

    return schema;
  },
  forTypeNode: (n: TypeNode): string => {
    switch (n.kind) {
      case SyntaxKind.TypeReference:
        if (!isTypeReferenceNode(n)) {
          throw new Error("Expected type reference!");
        }
        return Arbitraries.forTypeReference(n);
      case SyntaxKind.TypeLiteral:
        if (!isTypeLiteralNode(n)) throw new Error("Expected type literal!");
        return Arbitraries.forTypeLiteral(n);
      case SyntaxKind.LiteralType:
        if (!isLiteralTypeNode(n)) throw new Error("Expected literal type!");
        return Arbitraries.forLiteral(n.literal);
      case SyntaxKind.BigIntKeyword:
        return Arbitraries.forBigIntKeyword(n);
      case SyntaxKind.StringKeyword:
        return Arbitraries.forStringKeyword(n);
      case SyntaxKind.NumberKeyword:
        return Arbitraries.forNumberKeyword(n);
      case SyntaxKind.UndefinedKeyword:
        return Arbitraries.forUndefinedKeyword(n);
      case SyntaxKind.UnionType:
        if (!isUnionTypeNode(n)) throw new Error("Expected union type!");
        return Arbitraries.forUnion(n);
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forTypeLiteral: (n: TypeLiteralNode): string => {
    const lines: string[] = ["fc.record({"];

    n.forEachChild((child: Node) => {
      switch (child.kind) {
        case SyntaxKind.PropertySignature:
          if (!isPropertySignature(child)) {
            throw new Error("Expected property signature!");
          }
          if (!isIdentifier(child.name)) {
            throw new Error("Expected property name to be an identifier!");
          }
          const schema = Arbitraries.forPropertySignature(child);
          lines.push(`  ${child.name.escapedText}: ${schema},`);
          return;
      }
      throw new Error(`Unhandled TypeLiteral child: ${SyntaxKind[child.kind]}`);
    });

    lines.push("})");

    return lines.join("\n");
  },
  forLiteral: (n: LiteralTypeNode["literal"]): string => {
    switch (n.kind) {
      case SyntaxKind.StringLiteral:
        return `fc.constant('${n.text}')`;
      case SyntaxKind.NumericLiteral:
        return `fc.constant(${n.text})`;
      case SyntaxKind.BigIntLiteral:
        return `fc.constant(${n.text})`;
      case SyntaxKind.TrueKeyword:
        return `fc.constant(true)`;
      case SyntaxKind.FalseKeyword:
        return `fc.constant(false)`;
      case SyntaxKind.NullKeyword:
        return `fc.constant(null)`;
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forStringKeyword: (_: TypeNode): string => "fc.string()",
  forBigIntKeyword: (_: TypeNode): string => "fc.bigint()",
  forNumberKeyword: (_: TypeNode): string => "fc.double()",
  forUndefinedKeyword: (_: TypeNode): string => "fc.constant(undefined)",
  forTypeReference: (n: TypeReferenceNode): string => {
    if (!isIdentifier(n.typeName)) {
      throw new Error("Expected TypeReferenceNode to have an identifier!");
    }
    switch (n.typeName.escapedText) {
      case "Readonly": {
        const arg = n.typeArguments?.[0];
        if (arg === undefined) {
          throw new Error("Expected Readonly type to have an argument!");
        }
        return Arbitraries.forTypeNode(arg);
      }
    }
    return `arbitrary${n.typeName.escapedText}()`;
    // throw new Error(
    //   `Unsupported TypeName reference: ${SyntaxKind[n.typeName.kind]}`,
    // );
  },
  forUnion: (n: UnionTypeNode): string => {
    const children: string[] = [];
    for (const child of n.types) {
      children.push(Arbitraries.forTypeNode(child));
    }

    return `fc.oneof(${children.join(", ")})`;
  },
} as const;
