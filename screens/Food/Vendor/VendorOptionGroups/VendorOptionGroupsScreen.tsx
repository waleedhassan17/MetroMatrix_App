// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: the add-on group library
// ═══════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { groupRuleLabel } from '../../../../models/food/menuModel';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { AppText, Button, Card, Divider, EmptyState, InlineNotice, ScreenShell, SkeletonLines, TextAction, ToggleRow } from '../../../../Custom-Components/index';
import { formatPKR } from '../../../../utils/money';
import { haptics } from '../../../../utils/haptics';
import { loadOptionGroupsAsync, selectVendorOptionGroups, setOptionAvailableAsync } from './vendorOptionGroupsSlice';
import { menuPlace } from '../../../../models/food/vendorModel';
import { selectBusiness } from '../../../Auth/authSlice';

type Nav = { navigate: (name: string, params?: object) => void };

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.s4 },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s8 },
    headText: { flex: 1, gap: space.s4 },
  });

const VendorOptionGroupsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { back } = useBack(menuPlace(useAppSelector(selectBusiness)?.subType === 'home_kitchen'));
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectVendorOptionGroups);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadOptionGroupsAsync());
    }, [dispatch]),
  );

  return (
    <ServiceScope service="food">
      <ScreenShell
        title="Add-on groups"
        subtitle="Make a group once, offer it on any dish"
        onBack={back}
        refreshing={s.status === 'loading' && !!s.groups.length}
        onRefresh={() => void dispatch(loadOptionGroupsAsync())}
        footer={<Button label="New add-on group" leftIcon="add" onPress={() => navigation.navigate('VendorOptionGroup', {})} fullWidth />}
      >
        {s.error.message ? <InlineNotice message={s.error.message} /> : null}
        {s.status === 'loading' && !s.groups.length ? (
          <SkeletonLines lines={8} />
        ) : !s.groups.length ? (
          <EmptyState icon="sliders" title="No add-on groups yet" body="Spice level, extra toppings, a drink with the meal: customers pick from them on the dish." />
        ) : (
          s.groups.map(g => (
            <Card key={g.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.headText}>
                  <AppText variant="title">{g.name}</AppText>
                  <AppText variant="small" tone="muted">{`${groupRuleLabel(g)} · on ${g.usedByItems} ${g.usedByItems === 1 ? 'dish' : 'dishes'}`}</AppText>
                </View>
                <TextAction label="Edit" icon="create-outline" onPress={() => navigation.navigate('VendorOptionGroup', { id: g.id })} />
              </View>
              {g.options.map((o, i) => (
                <View key={o.id}>
                  {i > 0 ? <Divider /> : null}
                  <ToggleRow
                    label={o.name}
                    helper={[o.priceDelta ? `+ ${formatPKR(o.priceDelta)}` : 'No extra charge', o.isDefault ? 'Ticked to start' : null, s.available[o.id] === false ? 'Out of stock' : null]
                      .filter(Boolean)
                      .join(' · ')}
                    value={s.available[o.id] !== false}
                    disabled={s.saving.includes(o.id)}
                    onChange={v => {
                      haptics.select();
                      void dispatch(setOptionAvailableAsync({ optionId: o.id, isAvailable: v }));
                    }}
                  />
                </View>
              ))}
            </Card>
          ))
        )}
      </ScreenShell>
    </ServiceScope>
  );
};

export default VendorOptionGroupsScreen;
