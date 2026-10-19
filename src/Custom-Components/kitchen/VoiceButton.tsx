// ═══════════════════════════════════════════════════════
// VoiceButton — hold to talk (or tap to start, tap to stop)
// ═══════════════════════════════════════════════════════
// A round mic in the scope's accent with a ring that fills over the 30
// seconds a clip may last, a live level meter, the clock, and the language
// chip (Urdu / English / Auto, remembered by the caller). Haptics mark the
// start and the stop. The first time, a sheet explains what is recorded
// and why before the phone asks for the microphone. It hands the finished
// clip to `onClip`; uploading and understanding it is the screen's.

import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useStyles, useTheme, type Theme } from '../../theme';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { IonIcon } from '../Icon';
import { Sheet } from '../Sheet';
import { TextAction } from '../TextAction';
import { ChoiceChip } from '../shopping/ChoiceChip';
import { haptics } from '../../utils/haptics';
import { useClipRecorder, MAX_CLIP_MS, type Clip } from '../../services/voice/recorder';
import { LANGUAGE_CHOICES, WARN_CLIP_MS, secondsLeft } from '../../models/kitchen/voiceModel';
import type { VoiceLanguage } from '../../types/kitchen';

export interface VoiceButtonProps {
  onClip: (clip: Clip) => void;
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  /** The explainer has been seen on this device. */
  explained: boolean;
  onExplained: () => void;
  /** The clip is being uploaded or understood. */
  busy?: boolean;
  /** What to say ("Try “5 kilo tamatar 1200 rupay”"). */
  hint?: string;
  onTypeInstead?: () => void;
  disabled?: boolean;
}

/** A press shorter than this is a tap: recording keeps going until the next tap. */
const TAP_MS = 350;
const METER_BARS = [0.55, 0.85, 1, 0.8, 0.5];

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `0:${String(s).padStart(2, '0')}`;
};

const makeStyles = ({ space, size, radius, colors, service }: Theme) =>
  StyleSheet.create({
    root: { alignItems: 'center', gap: space.s12 },
    ringBox: { width: size.voiceButton + size.voiceRing * 4, height: size.voiceButton + size.voiceRing * 4, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute' },
    mic: {
      width: size.voiceButton,
      height: size.voiceButton,
      borderRadius: radius.pill,
      backgroundColor: service.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micOn: { backgroundColor: service.accentDeep },
    micOff: { backgroundColor: colors.disabled },
    status: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.meterHeight },
    meter: { flexDirection: 'row', alignItems: 'center', gap: space.s4, height: size.meterHeight },
    bar: { width: size.meterBar, borderRadius: radius.pill, backgroundColor: service.accent },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, flexWrap: 'wrap', justifyContent: 'center' },
    explain: { gap: space.s12 },
    point: { flexDirection: 'row', gap: space.s12, alignItems: 'flex-start' },
    pointText: { flex: 1 },
  });

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onClip, language, onLanguageChange, explained, onExplained, busy, hint, onTypeInstead, disabled }) => {
  const styles = useStyles(makeStyles);
  const { size, service, colors } = useTheme();
  const rec = useClipRecorder();
  const [explaining, setExplaining] = useState(false);
  const [denied, setDenied] = useState(false);
  const pressedAt = useRef(0);
  const tapMode = useRef(false);
  /** The same, for the spoken label (a ref can't be read while rendering). */
  const [tapping, setTapping] = useState(false);
  const setTap = (on: boolean) => {
    tapMode.current = on;
    setTapping(on);
  };
  /** The finger is still down (a release before recording began makes it a tap). */
  const held = useRef(false);
  const recording = rec.state.recording;
  const off = disabled || busy;

  const begin = async () => {
    setDenied(false);
    const ok = await rec.start();
    if (!ok) {
      setDenied(true);
      haptics.warning();
      return false;
    }
    if (!held.current) setTap(true);
    haptics.press();
    return true;
  };

  const finish = async () => {
    setTap(false);
    const clip = await rec.stop();
    haptics.success();
    if (clip) onClip(clip);
  };

  /** Press-in fired for this press (a very quick tap can skip it, notably on the web). */
  const pressedIn = useRef(false);

  const onPressIn = () => {
    if (off) return;
    pressedIn.current = true;
    if (!explained) {
      setExplaining(true);
      return;
    }
    if (recording) {
      // A tap while recording in tap mode stops it.
      if (tapMode.current) void finish();
      return;
    }
    pressedAt.current = Date.now();
    held.current = true;
    void begin();
  };

  const onPressOut = () => {
    const wasHeld = held.current;
    held.current = false;
    if (off || !explained || !wasHeld || !recording || tapMode.current) return;
    if (Date.now() - pressedAt.current < TAP_MS) setTap(true);
    else void finish();
  };

  /** A completed tap whose press-in never fired: start (tap mode) or stop, as a tap does. */
  const onPress = () => {
    const handled = pressedIn.current;
    pressedIn.current = false;
    if (off || handled) return;
    if (!explained) setExplaining(true);
    else if (recording) void finish();
    else {
      setTap(true);
      pressedAt.current = Date.now();
      void begin();
    }
  };

  const startFromExplainer = async () => {
    setExplaining(false);
    onExplained();
    setTap(true);
    pressedAt.current = Date.now();
    await begin();
  };

  const nextLanguage = () => {
    const i = LANGUAGE_CHOICES.findIndex(c => c.key === language);
    onLanguageChange(LANGUAGE_CHOICES[(i + 1) % LANGUAGE_CHOICES.length].key);
  };

  const r = (size.voiceButton + size.voiceRing * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = recording ? Math.min(1, rec.state.elapsedMs / MAX_CLIP_MS) : 0;
  const warn = rec.state.elapsedMs >= WARN_CLIP_MS;
  const level = rec.state.level ?? 0;
  const languageLabel = LANGUAGE_CHOICES.find(c => c.key === language)?.label ?? 'Auto';

  const label = busy
    ? 'Working out what you said'
    : recording
      ? `Recording, ${secondsLeft(rec.state.elapsedMs)} seconds left. ${tapping ? 'Tap to stop.' : 'Let go to stop.'}`
      : 'Speak: hold to talk, or tap to start';

  return (
    <View style={styles.root}>
      <View style={styles.ringBox}>
        <Svg width={r * 2 + size.voiceRing} height={r * 2 + size.voiceRing} style={styles.ring}>
          <Circle cx={r + size.voiceRing / 2} cy={r + size.voiceRing / 2} r={r} stroke={colors.line} strokeWidth={size.voiceRing} fill="none" />
          {recording ? (
            <Circle
              cx={r + size.voiceRing / 2}
              cy={r + size.voiceRing / 2}
              r={r}
              stroke={warn ? colors.warning : service.accent}
              strokeWidth={size.voiceRing}
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${r + size.voiceRing / 2} ${r + size.voiceRing / 2})`}
            />
          ) : null}
        </Svg>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          disabled={!!off}
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-disabled={!!off}
          aria-busy={!!busy}
          style={[styles.mic, recording && styles.micOn, off && styles.micOff]}>
          <IonIcon name={recording ? 'stop' : 'mic'} size="lg" color={service.onAccent} />
        </Pressable>
      </View>

      <View style={styles.status}>
        {recording ? (
          <>
            <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {METER_BARS.map((k, i) => (
                <View key={i} style={[styles.bar, { height: Math.max(size.meterBar, size.meterHeight * Math.min(1, level * k + 0.08)) }]} />
              ))}
            </View>
            <AppText variant="bodyStrong" tone={warn ? 'warning' : 'ink'}>
              {clock(rec.state.elapsedMs)} / 0:30
            </AppText>
          </>
        ) : (
          <AppText variant="small" tone="muted" align="center">
            {busy ? 'Working out what you said…' : (hint ?? 'Hold to talk, or tap to start')}
          </AppText>
        )}
      </View>

      <View style={styles.row}>
        <ChoiceChip label={languageLabel} icon="language-outline" onPress={nextLanguage} accessibilityHint="Changes the language you speak in" />
        {onTypeInstead ? <TextAction label="Type instead" icon="create-outline" onPress={onTypeInstead} /> : null}
      </View>

      {denied ? (
        <AppText variant="small" tone="muted" align="center" accessibilityLiveRegion="polite">
          The microphone is off for MetroMatrix. Turn it on in your phone’s settings{onTypeInstead ? ', or type instead.' : '.'}
        </AppText>
      ) : null}

      <Sheet
        visible={explaining}
        onClose={() => setExplaining(false)}
        title="Speak instead of typing"
        footer={<Button label="Turn on the microphone" onPress={() => void startFromExplainer()} fullWidth />}>
        <View style={styles.explain}>
          {[
            ['mic-outline', 'We record only while you hold the button, or until you tap again: 30 seconds at most.'],
            ['create-outline', 'What you said fills in the form. Nothing is saved until you check it and confirm.'],
            ['language-outline', 'Speak Urdu or English. Pick one on the chip, or let it work it out.'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.point}>
              <IonIcon name={icon as 'mic-outline'} size="md" color={service.accentDeep} />
              <AppText variant="body" style={styles.pointText}>
                {text}
              </AppText>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
};

export default VoiceButton;
