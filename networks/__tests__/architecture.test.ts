// The network layer keeps FinMatrix's architecture. Read from the sources:
//   • networks/network/ holds one main network file, apiHelpers.ts (and
//     the dummy API's test fixtures);
//   • a network function makes ONE request, returns the raw body
//     (`return response.data`) and throws `toApiError(e)` — named `…API`;
//   • networks never serialize or fan out: no serializer imports, no
//     Promise.all; slices (and the screens/**/shared compositions) do that.
// The one exception, as in FinMatrix: auth/authNetwork.ts, the session layer.

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '..');
const SESSION_LAYER = path.join(ROOT, 'auth', 'authNetwork.ts');

const networkFiles = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'network') networkFiles(p, out);
    } else if (/Network\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
};

const FILES = networkFiles(ROOT).filter(f => f !== SESSION_LAYER);
const parse = (file: string) => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const rel = (file: string) => path.relative(ROOT, file);

const isApiCall = (n: ts.Node): n is ts.CallExpression =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  ts.isIdentifier(n.expression.expression) &&
  n.expression.expression.text === 'api';

describe('the network layer (FinMatrix architecture)', () => {
  it('has one main network file in networks/network', () => {
    const entries = fs.readdirSync(path.join(ROOT, 'network')).filter(e => !['mock', '__tests__'].includes(e));
    expect(entries).toEqual(['apiHelpers.ts']);
  });

  it('finds the network files', () => {
    expect(FILES.length).toBeGreaterThan(80);
  });

  it('names every exported network function `…API`', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const st of parse(file).statements) {
        if (!ts.isVariableStatement(st) || !st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        for (const d of st.declarationList.declarations) {
          const isFn = d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
          if (isFn && !d.name.getText().endsWith('API')) offenders.push(`${rel(file)}: ${d.name.getText()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never serializes or fans out in a network file', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const sf = parse(file);
      for (const st of sf.statements) {
        if (ts.isImportDeclaration(st) && /serializers\//.test((st.moduleSpecifier as ts.StringLiteral).text)) {
          // Request-body helpers from healthCommon (Cloudinary ids, mime types) map the app's input, not a response.
          if (!/healthCommon'?$/.test(st.moduleSpecifier.getText(sf).replace(/'/g, ''))) offenders.push(`${rel(file)}: imports ${st.moduleSpecifier.getText(sf)}`);
        }
      }
      if (/\brequest(All)?\(|Promise\.all\(/.test(sf.getFullText())) offenders.push(`${rel(file)}: request()/requestAll()/Promise.all`);
    }
    expect(offenders).toEqual([]);
  });

  it('makes exactly one request per function, returning the raw body and throwing an ApiError', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const sf = parse(file);
      const calls = new Map<ts.Node, number>();
      const visit = (n: ts.Node) => {
        if (isApiCall(n)) {
          let fn: ts.Node | undefined = n.parent;
          while (fn && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn) && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
          if (fn) calls.set(fn, (calls.get(fn) ?? 0) + 1);
          else offenders.push(`${rel(file)}: a request outside a function`);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
      for (const [fn, count] of calls) {
        const text = fn.getText(sf);
        const name = fn.parent && ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText(sf) : '(function)';
        if (count !== 1) offenders.push(`${rel(file)}: ${name} makes ${count} requests`);
        if (!/const response = await api\./.test(text) || !/return response\.data;/.test(text) || !/throw toApiError\(e\);/.test(text)) {
          offenders.push(`${rel(file)}: ${name} is not the thin form`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
