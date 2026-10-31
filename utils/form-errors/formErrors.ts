// Which validation messages a form shows right now: a field's error appears
// once the field has been touched (blurred) or a submit was attempted.

export type Touched<K extends string> = Partial<Record<K, boolean>>;

export function visibleErrors<K extends string>(
  errors: Partial<Record<string, string>>,
  touched: Touched<K>,
  submitted = false,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const [field, message] of Object.entries(errors)) {
    if (message && (submitted || touched[field as K])) out[field as K] = message;
  }
  return out;
}
