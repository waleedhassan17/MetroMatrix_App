// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: a catering quote
// ═══════════════════════════════════════════════════════
// Lines from what the customer asked for at the menu's prices (or the last
// version's), each changed in place, more added from the menu or named;
// the delivery fee, the advance to ask for, how long it stays open, a note;
// the totals as it is typed. Sending makes it the next version.

import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ADVANCE_CHOICES, VALID_DAY_CHOICES, eventLine, latestQuote, quoteInput, quoteTotals, validateQuote } from '../../../../models/kitchen/cateringModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, BottomSheetPicker, Button, Card, ChoiceChip, Divider, IconButton, InlineNotice, ScreenShell, SkeletonLines, TextAction, TextField } from '../../../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../../../types';
import { formatPKR } from '../../../../utils/money';
import { haptics } from '../../../../utils/haptics';
import { addQuoteLine, editQuote, editQuoteLine, loadQuoteBuilderAsync, removeQuoteLine, selectQuoteBuilder, sendQuoteAsync, setQuoteErrors } from './quoteBuilderSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthQuote'>;

const makeStyles = ({ space, size, radius, colors, type }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    line: { gap: space.s8, paddingVertical: space.s12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    name: { flex: 1, flexBasis: 0, minWidth: 0 },
    nums: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
    input: {
      ...type.input,
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: size.control.sm,
      paddingHorizontal: space.s12,
      borderRadius: radius.md,
      borderWidth: size.border,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      color: colors.ink,
      textAlign: 'right',
    },
    inputError: { borderColor: colors.danger },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
    adds: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s16 },
  });

const QuoteBuilderScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <QuoteBuilderContent {...props} />
  </ServiceScope>
);

const QuoteBuilderContent: React.FC<Props> = ({ route }) => {
  const { code } = route.params;
  const { back } = useBack({ name: 'GrowthCateringRequest', params: { code } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const s = useAppSelector(selectQuoteBuilder);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void dispatch(loadQuoteBuilderAsync(code));
  }, [dispatch, code]);

  const r = s.code === code ? s.request : null;
  const d = s.code === code ? s.draft : null;
  if (!r || !d) {
    return (
      <ScreenShell title="Quote" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadQuoteBuilderAsync(code)) }} /> : <SkeletonLines lines={10} />}
      </ScreenShell>
    );
  }

  const t = quoteTotals(d);
  const version = (latestQuote(r)?.version ?? 0) + 1;

  const send = async () => {
    const { errors, lineErrors } = validateQuote(d);
    if (Object.keys(errors).length || Object.keys(lineErrors).length) {
      dispatch(setQuoteErrors({ errors, lineErrors }));
      haptics.warning();
      return;
    }
    const res = await dispatch(sendQuoteAsync({ code, input: quoteInput(d, r, Date.now()) }));
    if (sendQuoteAsync.fulfilled.match(res)) {
      haptics.success();
      Toast.show({ type: 'success', text1: `Quote v${version} sent`, text2: `${r.customer?.name ?? 'The customer'} can accept it now.` });
      back();
    } else haptics.warning();
  };

  return (
    <ScreenShell
      title={version > 1 ? `Quote, version ${version}` : 'Quote'}
      subtitle={eventLine(r)}
      onBack={back}
      footer={<Button label={`Send · ${formatPKR(t.total)}`} onPress={() => void send()} loading={s.sending} fullWidth />}>
      {s.sendError.message ? <InlineNotice message={s.sendError.message} /> : null}
      {r.budget ? (
        <AppText variant="small" tone={t.total > r.budget ? 'warning' : 'muted'}>
          {`Their budget is about ${formatPKR(r.budget)}${t.total > r.budget ? `; this is ${formatPKR(t.total - r.budget)} over.` : '.'}`}
        </AppText>
      ) : null}

      <Card padded="horizontal">
        {d.lines.map((l, n) => (
          <View key={l.key}>
            {n > 0 ? <Divider /> : null}
            <View style={styles.line}>
              <View style={styles.head}>
                <TextInput
                  value={l.name}
                  onChangeText={name => dispatch(editQuoteLine({ key: l.key, patch: { name } }))}
                  style={[styles.input, styles.name, { textAlign: 'left' }]}
                  placeholder="What it is"
                  placeholderTextColor={colors.inkFaint}
                  accessibilityLabel="Line name"
                />
                <IconButton icon="close" tone="muted" onPress={() => dispatch(removeQuoteLine(l.key))} accessibilityLabel={`Remove ${l.name || 'this line'}`} />
              </View>
              <View style={styles.nums}>
                <TextInput
                  value={l.qty}
                  onChangeText={qty => dispatch(editQuoteLine({ key: l.key, patch: { qty } }))}
                  keyboardType="number-pad"
                  style={[styles.input, s.lineErrors[l.key] ? styles.inputError : null]}
                  placeholder="Qty"
                  placeholderTextColor={colors.inkFaint}
                  accessibilityLabel={`${l.name}: how many`}
                />
                <AppText variant="body" tone="muted">
                  ×
                </AppText>
                <TextInput
                  value={l.unitPrice}
                  onChangeText={unitPrice => dispatch(editQuoteLine({ key: l.key, patch: { unitPrice } }))}
                  keyboardType="number-pad"
                  style={[styles.input, s.lineErrors[l.key] ? styles.inputError : null]}
                  placeholder="Rs each"
                  placeholderTextColor={colors.inkFaint}
                  accessibilityLabel={`${l.name}: price each`}
                />
                <AppText variant="bodyStrong" style={styles.name} align="right">
                  {formatPKR(t.lineTotal(l))}
                </AppText>
              </View>
              {s.lineErrors[l.key] ? (
                <AppText variant="caption" tone="danger">
                  {s.lineErrors[l.key]}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </Card>
      {s.errors.lines ? <InlineNotice message={s.errors.lines} /> : null}
      <View style={styles.adds}>
        <TextAction label="Add from the menu" icon="add" onPress={() => setPicking(true)} />
        <TextAction label="Add a line" icon="add" onPress={() => dispatch(addQuoteLine({ itemId: null, name: '', unitPrice: null, qty: r.guests }))} />
      </View>

      <TextField label="Delivery and serving (Rs)" value={d.deliveryFee} onChangeText={deliveryFee => dispatch(editQuote({ deliveryFee }))} keyboardType="number-pad" placeholder="0" error={s.errors.deliveryFee} />

      <View style={styles.gap}>
        <AppText variant="bodyStrong">Advance to ask for</AppText>
        <View style={styles.chips}>
          {ADVANCE_CHOICES.map(p => (
            <ChoiceChip key={p} label={p ? `${p}%` : 'None'} selected={d.advancePct === p} onPress={() => dispatch(editQuote({ advancePct: p }))} />
          ))}
        </View>
        <AppText variant="bodyStrong">Open for</AppText>
        <View style={styles.chips}>
          {VALID_DAY_CHOICES.map(n => (
            <ChoiceChip key={n} label={`${n} days`} selected={d.validDays === n} onPress={() => dispatch(editQuote({ validDays: n }))} />
          ))}
        </View>
      </View>

      <TextField label="Note (optional)" value={d.notes} onChangeText={notes => dispatch(editQuote({ notes }))} placeholder="Two serving staff included" maxLength={500} multiline />

      <Card>
        <View style={styles.gap}>
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              Food
            </AppText>
            <AppText variant="body">{formatPKR(t.subtotal)}</AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="title">Total</AppText>
            <AppText variant="title">{formatPKR(t.total)}</AppText>
          </View>
          <AppText variant="small" tone="muted">
            {t.advance ? `${formatPKR(t.advance)} advance to your own account, ${formatPKR(t.total - t.advance)} on the day.` : `${formatPKR(t.total)} on the day.`} MetroMatrix takes no commission.
          </AppText>
        </View>
      </Card>

      <BottomSheetPicker
        visible={picking}
        onClose={() => setPicking(false)}
        title="Add from the menu"
        options={s.menu.map(m => ({ value: m.id, label: `${m.name} · ${formatPKR(m.basePrice)}` }))}
        value={null}
        onSelect={itemId => {
          const m = s.menu.find(x => x.id === itemId);
          if (m) dispatch(addQuoteLine({ itemId: m.id, name: m.name, unitPrice: m.basePrice, qty: r.guests }));
          setPicking(false);
        }}
      />
    </ScreenShell>
  );
};

export default QuoteBuilderScreen;
