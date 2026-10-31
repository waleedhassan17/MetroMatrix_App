// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen growth: your link and QR code
// ═══════════════════════════════════════════════════════
// The kitchen's own page on the web (metromatrix.app/s/<slug>): copy it,
// send it on WhatsApp, save the QR image, print a counter card. "Orders you
// brought" counts this month's orders that came through the link or the
// QR, so the kitchen sees what its own customers order. Customers pay the
// kitchen directly; MetroMatrix takes no commission on any order.

import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useBack } from '../../hooks/useBack';
import { broughtCount, shortUrl, storefrontStatLines } from '../../models/kitchen/reachModel';
import { monthLabel } from '../../models/kitchen/tiffinModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ScreenShell, SkeletonLines } from '../../Custom-Components/index';
import type { FoodVendorStackParamList } from '../../models';
import { printStoreCard, shareQrImage } from '../../services/storefront/storefrontQr';
import { shareText } from '../../utils/share-text/shareText';
import { haptics } from '../../utils/haptics/haptics';
import { loadStorefrontAsync, selectStorefront } from './storefrontSlice';

type Props = NativeStackScreenProps<FoodVendorStackParamList, 'GrowthStorefront'>;
type QrRef = { toDataURL: (cb: (base64: string) => void) => void };

const makeStyles = ({ space, radius, colors, size }: Theme) =>
  StyleSheet.create({
    gap: { gap: space.s12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.s12 },
    // Stacked: the labels are long for a phone's width side by side.
    buttons: { gap: space.s8 },
    button: { alignSelf: 'stretch' },
    plate: { alignSelf: 'center', padding: space.s16, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: size.border, borderColor: colors.lineSoft },
    url: { padding: space.s12, borderRadius: radius.sm, backgroundColor: colors.surfaceSunk },
  });

const Storefront: React.FC<Props> = props => (
  <ServiceScope service="food">
    <StorefrontContent {...props} />
  </ServiceScope>
);

const StorefrontContent: React.FC<Props> = () => {
  const { back } = useBack({ name: 'VendorTabs', params: { screen: 'KitchenTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { size, colors, service } = useTheme();
  const s = useAppSelector(selectStorefront);
  const qr = useRef<QrRef | null>(null);
  const [busy, setBusy] = useState<'image' | 'card' | null>(null);

  const load = useCallback(() => void dispatch(loadStorefrontAsync()), [dispatch]);
  useFocusEffect(load);

  const f = s.data;
  const name = f?.name ?? 'Your kitchen';
  if (!f) {
    return (
      <ScreenShell title="Your link and QR" onBack={back}>
        {s.status === 'failed' ? <InlineNotice message={s.error.message} action={{ label: 'Try again', onPress: load }} /> : <SkeletonLines lines={8} />}
      </ScreenShell>
    );
  }

  const copy = async () => {
    haptics.press();
    await Clipboard.setStringAsync(f.url);
    Toast.show({ type: 'success', text1: 'Link copied' });
  };
  const send = async () => {
    haptics.press();
    const r = await shareText(f.shareText, name);
    if (r === 'copied') Toast.show({ type: 'success', text1: 'Copied', text2: 'Paste it into WhatsApp or a message.' });
  };
  /** On a phone the on-screen QR gives its PNG; in a browser it's drawn again at print size. */
  const pngOf = () => new Promise<string | null>(res => (Platform.OS === 'web' || !qr.current ? res(null) : qr.current.toDataURL(d => res(d))));
  const saveImage = async () => {
    setBusy('image');
    try {
      const r = await shareQrImage({ url: f.qrUrl, slug: f.slug, name, pngBase64: await pngOf() });
      if (r === 'downloaded') Toast.show({ type: 'success', text1: 'QR image saved', text2: 'Find it in your downloads.' });
      if (r === 'unavailable') Toast.show({ type: 'info', text1: 'Sharing isn’t available here', text2: 'Print the card instead.' });
    } catch {
      Toast.show({ type: 'error', text1: 'The image didn’t save', text2: 'Try again.' });
    } finally {
      setBusy(null);
    }
  };
  const printCard = async () => {
    setBusy('card');
    try {
      await printStoreCard({ name, qrUrl: f.qrUrl, shortUrl: shortUrl(f.url) }, { ink: colors.ink, muted: colors.inkMuted, line: colors.line, accent: service.accentDeep });
    } catch {
      Toast.show({ type: 'error', text1: 'The card didn’t print', text2: 'Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const brought = broughtCount(f);
  return (
    <ScreenShell title="Your link and QR" subtitle="Your own page, to share anywhere" onBack={back} refreshing={s.status === 'loading'} onRefresh={load}>
      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Your link</AppText>
          <View style={styles.url}>
            <AppText variant="bodyStrong" selectable accessibilityLabel={`Your link: ${f.url}`}>
              {shortUrl(f.url)}
            </AppText>
          </View>
          <AppText variant="small" tone="muted">
            Anyone can open it, even without the app, and order from you.
          </AppText>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button label="Copy link" variant="secondary" leftIcon="copy-outline" onPress={() => void copy()} fullWidth />
            </View>
            <View style={styles.button}>
              <Button label="Send on WhatsApp" leftIcon="share-social-outline" onPress={() => void send()} fullWidth />
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.gap}>
          <AppText variant="title">Your QR code</AppText>
          <View style={styles.plate} accessible accessibilityLabel={`QR code that opens ${shortUrl(f.url)}`}>
            <QRCode value={f.qrUrl} size={size.qr} color={colors.ink} backgroundColor={colors.surface} getRef={(c: QrRef | null) => (qr.current = c)} />
          </View>
          <AppText variant="small" tone="muted" align="center">
            Put it on your counter, menus and delivery bags. Scans count separately from the link.
          </AppText>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button label={Platform.OS === 'web' ? 'Download the image' : 'Share the image'} variant="secondary" leftIcon="image-outline" loading={busy === 'image'} onPress={() => void saveImage()} fullWidth />
            </View>
            <View style={styles.button}>
              <Button label="Print a counter card" variant="secondary" leftIcon="print-outline" loading={busy === 'card'} onPress={() => void printCard()} fullWidth />
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.gap}>
          <View style={styles.row}>
            <AppText variant="title">Orders you brought</AppText>
            <AppText variant="caption" tone="muted">
              {f.stats.month ? monthLabel(f.stats.month) : 'This month'}
            </AppText>
          </View>
          <AppText variant="display" accessibilityLabel={`${brought} orders through your link and QR this month`}>
            {String(brought)}
          </AppText>
          <AppText variant="small" tone="muted">
            Through your link or QR code this month.
          </AppText>
          <Divider />
          {storefrontStatLines(f).map(l => (
            <View key={l.key} style={styles.row}>
              <AppText variant="body">{l.label}</AppText>
              <AppText variant="bodyStrong">{String(l.value)}</AppText>
            </View>
          ))}
        </View>
      </Card>

      <AppText variant="caption" tone="muted">
        Customers pay you directly. MetroMatrix takes no commission on any order, from the app or from your link.
      </AppText>
    </ScreenShell>
  );
};

export default Storefront;
