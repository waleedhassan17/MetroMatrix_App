// DoctorReviewItem — one patient's review: initials, name (or initials when
// posted anonymously), date, video or clinic, stars, tags, words, and the
// doctor's reply indented under it.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../../theme';
import type { DoctorReview } from '../../types/health';
import { formatOn } from '../../utils/healthTime';
import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { IonIcon } from '../Icon';
import { Stars } from '../shopping/Stars';

const makeStyles = ({ colors, space, radius }: Theme) =>
  StyleSheet.create({
    root: { gap: space.s8, paddingVertical: space.s16 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
    who: { flex: 1, gap: space.s0 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4 },
    tag: { paddingHorizontal: space.s8, paddingVertical: space.s0, borderRadius: radius.pill, backgroundColor: colors.surfaceSunk },
    reply: { gap: space.s4, padding: space.s12, marginLeft: space.s24, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
    replyHead: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  });

export const DoctorReviewItem: React.FC<{ review: DoctorReview; doctorName?: string; footer?: React.ReactNode }> = ({ review: r, doctorName, footer }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Avatar name={r.authorName} size="sm" />
        <View style={styles.who}>
          <AppText variant="bodyStrong">{r.authorName}</AppText>
          <AppText variant="caption" tone="muted">
            {formatOn(r.createdAt)} · {r.kind === 'video' ? 'Video consultation' : 'Clinic visit'}
          </AppText>
        </View>
        <Stars rating={r.rating} />
      </View>
      {r.recommend !== null || r.tags.length ? (
        <View style={styles.meta}>
          {r.recommend ? (
            <AppText variant="caption" tone="success">
              Recommends this doctor
            </AppText>
          ) : null}
          {r.tags.length ? (
            <View style={styles.tags}>
              {r.tags.map(t => (
                <View key={t} style={styles.tag}>
                  <AppText variant="caption">{t}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {r.text ? <AppText variant="body">{r.text}</AppText> : null}
      {r.reply ? (
        <View style={styles.reply}>
          <View style={styles.replyHead}>
            <IonIcon name="chatbubble-ellipses-outline" size="sm" color={colors.inkMuted} />
            <AppText variant="small">{doctorName ? `Reply from ${doctorName}` : "Doctor's reply"}</AppText>
          </View>
          <AppText variant="small" tone="muted">
            {r.reply.text}
          </AppText>
        </View>
      ) : null}
      {footer}
    </View>
  );
};

export default DoctorReviewItem;
