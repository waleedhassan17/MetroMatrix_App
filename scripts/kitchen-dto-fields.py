# Usage: python3 scripts/kitchen-dto-fields.py ~/MetroMatix-NestJS/src > networks/__tests__/fixtures/dtoFields.json
# openapi.json lists only fields with @ApiProperty; the DTO classes are the truth for request bodies.
# Route (METHOD /path/{param}) → the @Body() DTO's field names (with inherited ones), from a NestJS source tree.
import json, os, re, sys
root = sys.argv[1]
files = []
for d, _, fs in os.walk(root):
    for f in fs:
        if f.endswith('.ts') and not f.endswith('.spec.ts'):
            files.append(os.path.join(d, f))
src = {f: open(f).read() for f in files}
# Classes: name -> (fields, parent)
classes = {}
for f, s in src.items():
    for m in re.finditer(r'(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+)(?:<[^>]*>)?)?(?:\s+implements[^{]*)?\s*\{', s):
        name, parent = m.group(1), m.group(2)
        i = m.end(); depth = 1; j = i
        while j < len(s) and depth:
            if s[j] == '{': depth += 1
            elif s[j] == '}': depth -= 1
            j += 1
        # A type that wraps to the next line (`supplierId?:\n    string | null;`) is one declaration.
        body = re.sub(r'([!?]:)\s*\n\s*', r'\1 ', s[i:j-1])
        # Top-level property declarations only (depth 0 inside the class body).
        fields = []; depth = 0; buf = ''
        for line in body.split('\n'):
            stripped = line.strip()
            if depth == 0:
                for fm in re.finditer(r'(?:^|[\s)])([A-Za-z_]\w*)[!?]\s*:\s*[^=;]+;', stripped):
                    nm = fm.group(1)
                    if nm not in ('return',) and not stripped.startswith(('//', '*', '/*')):
                        fields.append(nm)
            depth += line.count('{') - line.count('}')
            if depth < 0: depth = 0
        classes[name] = (fields, parent)
def all_fields(c, seen=None):
    seen = seen or set()
    if c not in classes or c in seen: return []
    seen.add(c)
    fs, p = classes[c]
    return fs + (all_fields(p, seen) if p else [])
out = {}
for f, s in src.items():
    if '@Controller' not in s: continue
    for cm in re.finditer(r"@Controller\(\s*'([^']*)'\s*\)", s):
        base = cm.group(1)
        # the controller class body follows; scan methods until next @Controller
        nxt = s.find('@Controller', cm.end())
        block = s[cm.end(): nxt if nxt > 0 else len(s)]
        for mm in re.finditer(r"@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)", block):
            verb, sub = mm.group(1).upper(), mm.group(2) or ''
            rest = block[mm.end(): mm.end() + 1500]
            sig = re.search(r'\n\s*(?:async\s+)?\w+\s*\((.*?)\)\s*(?::[^{]*)?\{', rest, re.S)
            if not sig: continue
            b = re.search(r'@Body\(\)\s*\w+\s*:\s*(\w+)', sig.group(1))
            path = '/api/v1/' + '/'.join(p for p in (base.strip('/'), sub.strip('/')) if p)
            path = re.sub(r':(\w+)', r'{\1}', path)
            if b:
                out[f'{verb} {path}'] = sorted(set(all_fields(b.group(1))))
json.dump(out, sys.stdout, indent=0, sort_keys=True)
