// ═══════════════════════════════════════════════════════
// MetroMatrix — Voice entry, ready to drop into a screen
// ═══════════════════════════════════════════════════════
// The mic (VoiceButton) with this device's language and explainer, the
// result as a confirm card (VoiceResultCard), "Type instead", and — when
// the assistant is off or used up — a plain note while the screen's own
// form carries on. The screen decides what Confirm does (its slice calls
// the ordinary endpoint) and answers whether it worked; then this clears.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useStyles, type Theme } from '../../theme';
import { Button, InlineNotice, TextField, VoiceButton, VoiceResultCard } from '../../Custom-Components';
import { selectMicExplained, selectVoiceLanguage, setMicExplained, setVoiceLanguage } from '../../store/preferencesSlice';
import { aiDownNote, isAiDown } from '../../models/kitchen/aiModel';
import { VOICE_HINTS } from '../../models/kitchen/voiceModel';
import type { VoiceAction, VoiceContext } from '../../types/kitchen';
import { clearVoice, interpretClipAsync, interpretTextAsync, selectVoiceRun, setVoiceTyped, setVoiceTyping } from './voiceSlice';

export interface VoiceEntryProps {
  context: VoiceContext;
  /** Do it; true when it worked (the card then clears). */
  onConfirm: (action: VoiceAction) => Promise<boolean> | boolean;
  /** Open the screen's form filled from the action, to change it first. */
  onEdit?: (action: VoiceAction) => void;
  /** The screen is carrying out a confirmed action. */
  busy?: boolean;
  hint?: string;
}


const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s12 },
    typed: { gap: space.s8 },
  });

export const VoiceEntry: React.FC<VoiceEntryProps> = ({ context, onConfirm, onEdit, busy, hint }) => {
  const styles = useStyles(makeStyles);
  const dispatch = useAppDispatch();
  const run = useAppSelector(s => selectVoiceRun(s, context));
  const language = useAppSelector(selectVoiceLanguage);
  const explained = useAppSelector(selectMicExplained);
  const working = run.status === 'working';

  const confirm = async (action: VoiceAction) => {
    if (await onConfirm(action)) dispatch(clearVoice(context));
  };

  const submitTyped = () => {
    if (run.typed.trim()) void dispatch(interpretTextAsync({ context, language, text: run.typed }));
  };

  const down = run.status === 'failed' && isAiDown(run.error.code);

  return (
    <View style={styles.root}>
      {run.status === 'result' && run.result ? (
        <VoiceResultCard
          result={run.result}
          onConfirm={a => void confirm(a)}
          onEdit={
            onEdit
              ? a => {
                  onEdit(a);
                  dispatch(clearVoice(context));
                }
              : undefined
          }
          onRetry={() => dispatch(clearVoice(context))}
          onDiscard={() => dispatch(clearVoice(context))}
          busy={busy}
        />
      ) : down ? (
        <InlineNotice tone="info" title={aiDownNote(run.error.code, run.error.details).title} message={aiDownNote(run.error.code, run.error.details).message} action={{ label: 'OK', onPress: () => dispatch(clearVoice(context)) }} />
      ) : (
        <VoiceButton
          onClip={clip => void dispatch(interpretClipAsync({ context, language, clip }))}
          language={language}
          onLanguageChange={l => dispatch(setVoiceLanguage(l))}
          explained={explained}
          onExplained={() => dispatch(setMicExplained())}
          busy={working}
          hint={hint ?? VOICE_HINTS[context]}
          onTypeInstead={() => dispatch(setVoiceTyping({ context, typing: !run.typing }))}
        />
      )}

      {run.status === 'failed' && !down ? <InlineNotice message={run.error.message} action={{ label: 'Try again', onPress: () => dispatch(clearVoice(context)) }} /> : null}

      {run.typing && run.status !== 'result' ? (
        <View style={styles.typed}>
          <TextField
            label="Say it in words"
            value={run.typed}
            onChangeText={text => dispatch(setVoiceTyped({ context, text }))}
            helper="Urdu or English, as you would say it"
          />
          <Button label="Understand this" variant="secondary" onPress={submitTyped} loading={working} disabled={!run.typed.trim()} />
        </View>
      ) : null}
    </View>
  );
};

export default VoiceEntry;
