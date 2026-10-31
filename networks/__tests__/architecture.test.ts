// The network layer keeps Consultant_Mobile's architecture. Read from the sources:
//   • networks/network/ holds one main network file, network.ts (and the
//     dummy API's test fixtures): the API URL, the axios instance and the
//     API.GET/POST/PUT/PATCH/DELETE functions every network file calls;
//   • a network function makes ONE request through `API`, returns the raw
//     body (`return response.data`) and throws `toApiError(e)`; its name is
//     plain (`fetchCart`, `cancelOrder`), never `getXAPI`;
//   • networks never serialize or fan out: no serializer imports, no
//     Promise.all; slices (and the screens/shared compositions) do that.
// The exceptions: networks/authcalls/, the session layer (it stores the
// tokens), and health/referenceIndex.ts, a session cache over two reads.

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '..');
const SESSION_LAYER = path.join(ROOT, 'authcalls');
const NOT_NETWORK_FILES = [path.join(ROOT, 'health', 'referenceIndex.ts')];

const networkFiles = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'network' && p !== SESSION_LAYER) networkFiles(p, out);
    } else if (/\.ts$/.test(e.name) && !NOT_NETWORK_FILES.includes(p)) {
      out.push(p);
    }
  }
  return out;
};

const FILES = networkFiles(ROOT);
const parse = (file: string) => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const rel = (file: string) => path.relative(ROOT, file);

const isApiCall = (n: ts.Node): n is ts.CallExpression =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  ts.isIdentifier(n.expression.expression) &&
  n.expression.expression.text === 'API';

describe('the network layer (Consultant_Mobile architecture)', () => {
  it('has one main network file in networks/network', () => {
    const entries = fs.readdirSync(path.join(ROOT, 'network')).filter(e => !['mock', '__tests__'].includes(e));
    expect(entries).toEqual(['network.ts']);
  });

  it('finds the network files', () => {
    expect(FILES.length).toBeGreaterThan(80);
  });

  it('names every exported network function plainly (fetchCart, never getCartAPI)', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const st of parse(file).statements) {
        if (!ts.isVariableStatement(st) || !st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        for (const d of st.declarationList.declarations) {
          const isFn = d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
          if (isFn && (/API$/.test(d.name.getText()) || /^get[A-Z]/.test(d.name.getText()))) offenders.push(`${rel(file)}: ${d.name.getText()}`);
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
        if (!/const response = await API\.(GET|POST|PUT|PATCH|DELETE)\(\{ URL: /.test(text) || !/return response\.data;/.test(text) || !/throw toApiError\(e\);/.test(text)) {
          offenders.push(`${rel(file)}: ${name} is not the thin form`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─── The app around it (Consultant_Mobile's layout and slices) ───
//   • every folder sits at the repo root: no src/, and imports are relative
//     (no path aliases in tsconfig, babel or the code);
//   • every screen has its own flat kebab-case folder,
//     screens/<name>-screen/ (screens/shared and screens/__tests__ beside them);
//   • a thunk returns what the network answered and its `fulfilled` reducer
//     serializes it. A thunk may read an answer through a serializer only
//     inside required(…): to decide its next call, or to hand app shapes to
//     another slice (setUser, setBusiness).

const REPO = path.join(ROOT, '..');
const ALIAS = /^@(\/|screens\/|components\/|custom\/|store\/|networks\/|models\/|serializers\/|hooks\/|theme\/|utils\/|navigators\/|assets\/)/;
const SKIP = ['node_modules', '.git', 'dist', 'android', 'ios', '.expo', 'scripts'];

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP.includes(e.name)) sourceFiles(p, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
};

describe("the app's layout and slices (Consultant_Mobile architecture)", () => {
  it('keeps every folder at the repo root, with relative imports', () => {
    expect(fs.existsSync(path.join(REPO, 'src'))).toBe(false);
    const tsconfig = JSON.parse(fs.readFileSync(path.join(REPO, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.paths).toBeUndefined();
    expect(fs.readFileSync(path.join(REPO, 'babel.config.js'), 'utf8')).not.toMatch(/module-resolver/);
    const offenders: string[] = [];
    for (const file of sourceFiles(REPO)) {
      for (const st of parse(file).statements) {
        if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && ALIAS.test(st.moduleSpecifier.text)) {
          offenders.push(`${path.relative(REPO, file)}: ${st.moduleSpecifier.text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('gives every screen its own flat kebab-case folder (screens/<name>-screen/)', () => {
    const folders = fs
      .readdirSync(path.join(REPO, 'screens'), { withFileTypes: true })
      .filter(e => e.isDirectory() && !['shared', '__tests__'].includes(e.name))
      .map(e => e.name);
    expect(folders.length).toBeGreaterThan(200);
    expect(folders.filter(f => !/^[a-z0-9]+(-[a-z0-9]+)*-(screen|sheet)$/.test(f))).toEqual([]);
    expect(folders.filter(f => fs.readdirSync(path.join(REPO, 'screens', f), { withFileTypes: true }).some(e => e.isDirectory()))).toEqual([]);
  });

  it('returns the raw body from every thunk; fulfilled serializes it', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(REPO).filter(f => /Slice\.ts$/.test(f))) {
      const sf = parse(file);
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n) && n.expression.getText(sf) === 'create.asyncThunk' && n.arguments[0]) {
          const name = ts.isPropertyAssignment(n.parent) ? n.parent.name.getText(sf) : '(thunk)';
          const inThunk = (m: ts.Node) => {
            if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && /Serializer$/.test(m.expression.text)) {
              const p = m.parent;
              if (!(ts.isCallExpression(p) && p.expression.getText(sf) === 'required')) offenders.push(`${path.relative(REPO, file)}: ${name} serializes ${m.expression.text}`);
            }
            ts.forEachChild(m, inThunk);
          };
          inThunk(n.arguments[0]);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(offenders).toEqual([]);
  });
});
