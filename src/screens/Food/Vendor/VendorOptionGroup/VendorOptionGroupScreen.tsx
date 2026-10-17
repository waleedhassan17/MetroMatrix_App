// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one add-on group (new or edit)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useBack } from '@hooks/useBack';
import { MAX_OPTIONS, groupRuleLabel, validateGroup } from '@models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import { AppText, Button, Card, Checkbox, IconButton, InlineNotice, QuantityStepper, ScreenShell, SkeletonLines, TextAction, TextField, ToggleRow } from '@custom/index';
import type { FoodVendorStackParamList } from '@/types';
import { Alert } from '@utils/alert';
import { haptics } from '@utils/haptics';
import {
  addGroupOption,
  deleteOptionGroupAsync,
  loadOptionGroupAsync,
  markGroupSubmitted,
  removeGroupOption,
  saveOptionGroupAsync,
  selectVendorOptionGroup,
  setGroupMax,
  setGroupMin,
  setGroupName,
  setGroupOption,
  setGroupRequired,
  toggleGroupOptionDefault,
} from './vendorOptionGroupSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'VendorOptionGroup'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s12 },
    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12 },
    option: { gap: space.s8 },
    optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
    optionName: { flex: 3 },
    optionPrice: { flex: 2 },
  });

const VendorOptionGroupScreen: React.FC<Props> = props => (
  <ServiceScope service="food">
    <VendorOptionGroupContent {...props} />
  </ServiceScope>
);

const VendorOptionGroupContent: React.FC<Props> = ({ route }) => {
  const id = route.params?.id;
  const { back } = useBack({ name: 'VendorOptionGroups' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorOptionGroup);
  const f = s.form;

  useEffect(() => {
    void dispatch(loadOptionGroupAsync(id));
  }, [dispatch, id]);

  const title = id ? 'Edit add-on group' : 'New add-on group';
  if (!f || s.status === 'loading') {
    return (
      <ScreenShell title={title} onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadOptionGroupAsync(id)) }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const errors = s.submitted ? validateGroup(f) : {};
  const required = f.minSelect >= 1;

  const save = async () => {
    dispatch(markGroupSubmitted());
    if (Object.keys(validateGroup(f)).length) {
      haptics.warning();
      return;
    }
    const r = await dispatch(saveOptionGroupAsync());
    if (saveOptionGroupAsync.fulfilled.match(r)) {
      haptics.success();
      Toast.show({ type: 'success', text1: id ? 'Group saved' : 'Group added', text2: id && s.group?.usedByItems ? `Updated on ${s.group.usedByItems} dishes.` : undefined });
      back();
    } else haptics.warning();
  };

  const remove = () =>
    Alert.alert(
      `Delete ${f.name || 'this group'}?`,
      s.group?.usedByItems ? `It comes off the ${s.group.usedByItems} ${s.group.usedByItems === 1 ? 'dish' : 'dishes'} that offer it.` : undefined,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const r = await dispatch(deleteOptionGroupAsync(id!));
            if (deleteOptionGroupAsync.fulfilled.match(r)) {
              Toast.show({ type: 'success', text1: 'Group deleted' });
              back();
            }
          },
        },
      ],
    );

  return (
    <ScreenShell
      title={title}
      subtitle={s.group?.usedByItems ? `On ${s.group.usedByItems} ${s.group.usedByItems === 1 ? 'dish' : 'dishes'}` : undefined}
      onBack={back}
      footer={<Button label={id ? 'Save group' : 'Add group'} onPress={() => void save()} loading={s.saving} fullWidth />}
    >
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      <TextField label="Name" value={f.name} onChangeText={v => dispatch(setGroupName(v))} error={errors.name} maxLength={80} placeholder="Spice level" />

      <Card style={styles.card}>
        <AppText variant="title">How customers choose</AppText>
        <ToggleRow label="Customers must choose" helper="They can’t add the dish until they pick" value={required} onChange={v => dispatch(setGroupRequired(v))} />
        {required ? (
          <View style={styles.stepRow}>
            <AppText variant="bodyStrong">At least</AppText>
            <QuantityStepper value={f.minSelect} onChange={n => dispatch(setGroupMin(n))} min={1} max={Math.max(1, f.options.length)} label="Least choices" />
          </View>
        ) : null}
        <View style={styles.stepRow}>
          <AppText variant="bodyStrong">At most</AppText>
          <QuantityStepper value={f.maxSelect} onChange={n => dispatch(setGroupMax(n))} min={Math.max(1, f.minSelect)} max={Math.max(1, f.options.length)} label="Most choices" />
        </View>
        <AppText variant="small" tone={errors.rule ? 'danger' : 'muted'}>
          {errors.rule ?? `Customers see: ${groupRuleLabel(f)}`}
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="title">Choices</AppText>
        {errors.options ? (
          <AppText variant="small" tone="danger">
            {errors.options}
          </AppText>
        ) : null}
        {f.options.map((o, i) => (
          <View key={i} style={styles.option}>
            <View style={styles.optionRow}>
              <View style={styles.optionName}>
                <TextField label="Choice" value={o.name} onChangeText={v => dispatch(setGroupOption({ index: i, field: 'name', value: v }))} error={errors[`options.${i}.name`]} maxLength={80} placeholder="Raita" />
              </View>
              <View style={styles.optionPrice}>
                <TextField
                  label="Extra (Rs)"
                  value={o.priceDelta}
                  onChangeText={v => dispatch(setGroupOption({ index: i, field: 'priceDelta', value: v.replace(/[^\d]/g, '') }))}
                  error={errors[`options.${i}.priceDelta`]}
                  keyboardType="number-pad"
                />
              </View>
              <IconButton icon="close" accessibilityLabel={`Remove ${o.name || 'this choice'}`} disabled={f.options.length <= 1} onPress={() => dispatch(removeGroupOption(i))} />
            </View>
            <Checkbox checked={o.isDefault} onToggle={() => dispatch(toggleGroupOptionDefault(i))} label="Ticked to start" accessibilityLabel={`${o.name || 'This choice'} is ticked to start`} />
          </View>
        ))}
        {f.options.length < MAX_OPTIONS ? <TextAction label="Add a choice" icon="add" onPress={() => dispatch(addGroupOption())} /> : null}
      </Card>

      {id ? <TextAction label="Delete this group" icon="trash-outline" tone="danger" onPress={remove} /> : null}
    </ScreenShell>
  );
};

export default VendorOptionGroupScreen;
