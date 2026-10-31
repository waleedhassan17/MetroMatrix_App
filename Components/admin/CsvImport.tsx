// ═══════════════════════════════════════════════════════
// MetroMatrix — the staff console's CSV import
// ═══════════════════════════════════════════════════════
// Choose a file or paste the text; "Check the file" runs the server's dry
// run, which names every bad row; the first rows show what the import
// would do. "Import" is offered only when every row is fine, and the
// server takes the whole file or none of it. Tokens only.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { canImport, importSummary } from '../../models/kitchen/adminKitchenModel';
import { useStyles, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, InlineNotice, StatusPill, TextField } from '../../Custom-Components/index';
import type { CsvImportResult } from '../../types';

type PillTone = React.ComponentProps<typeof StatusPill>['tone'];

export interface CsvPreviewRow {
  key: string;
  title: string;
  line: string;
  pill?: { label: string; tone: PillTone };
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    tight: { gap: space.s4 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12, paddingVertical: space.s8 },
    grow: { flex: 1, gap: space.s4 },
  });

export const CsvImport = <T,>({
  columns,
  example,
  csv,
  fileName,
  onChangeCsv,
  onPickFile,
  onCheck,
  onImport,
  result,
  checking,
  importing,
  error,
  formError,
  previewOf,
}: {
  columns: string[];
  /** One sample data row, shown under the columns. */
  example: string;
  csv: string;
  fileName: string | null;
  onChangeCsv: (text: string) => void;
  onPickFile: () => void;
  onCheck: () => void;
  onImport: () => void;
  result: CsvImportResult<T> | null;
  checking: boolean;
  importing: boolean;
  error: string;
  /** The text's own problem (no header, no rows), before it is sent. */
  formError?: string;
  previewOf: (row: T) => CsvPreviewRow;
}) => {
  const styles = useStyles(makeStyles);
  const ready = canImport(result);
  return (
    <Card>
      <View style={styles.gap}>
        <AppText variant="title">Import from CSV</AppText>
        <View style={styles.tight}>
          <AppText variant="small" tone="muted">
            {`The first row names the columns: ${columns.join(', ')}. For example:`}
          </AppText>
          <AppText variant="small">{example}</AppText>
        </View>
        <Button
          label={fileName ? `Chosen: ${fileName}` : 'Choose a CSV file'}
          variant="secondary"
          leftIcon="document-text-outline"
          onPress={onPickFile}
          fullWidth
        />
        <TextField
          label="Or paste the CSV"
          value={csv}
          onChangeText={onChangeCsv}
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          error={formError}
        />
        <Button
          label="Check the file"
          variant="secondary"
          loading={checking}
          disabled={!csv.trim() || importing}
          onPress={onCheck}
          fullWidth
        />
        {error ? <InlineNotice message={error} /> : null}
        {result ? (
          <View style={styles.gap}>
            <AppText variant="bodyStrong">{importSummary(result)}</AppText>
            {result.errors.length ? (
              <View>
                <AppText variant="overline" tone="muted">
                  Problems
                </AppText>
                {result.errors.map((e, n) => (
                  <View key={`${e.row}-${e.field}-${n}`}>
                    {n ? <Divider /> : null}
                    <View style={styles.row}>
                      <StatusPill label={`Row ${e.row}`} tone="danger" />
                      <AppText variant="small" style={styles.grow}>
                        {`${e.field}: ${e.message}`}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {result.preview.length ? (
              <View>
                <AppText variant="overline" tone="muted">
                  {result.dryRun ? 'What it would do' : 'Imported'}
                </AppText>
                {result.preview.map((r, n) => {
                  const p = previewOf(r);
                  return (
                    <View key={p.key}>
                      {n ? <Divider /> : null}
                      <View style={styles.row}>
                        <View style={styles.grow}>
                          <AppText variant="body">{p.title}</AppText>
                          <AppText variant="small" tone="muted">
                            {p.line}
                          </AppText>
                        </View>
                        {p.pill ? <StatusPill label={p.pill.label} tone={p.pill.tone} /> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {result.dryRun ? (
              <Button
                label={ready ? `Import ${result.rows} ${result.rows === 1 ? 'row' : 'rows'}` : 'Fix the problems to import'}
                loading={importing}
                disabled={!ready}
                onPress={onImport}
                fullWidth
              />
            ) : (
              <AppText variant="small" tone="muted">
                {`${result.imported} ${result.imported === 1 ? 'row' : 'rows'} imported.`}
              </AppText>
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
};
