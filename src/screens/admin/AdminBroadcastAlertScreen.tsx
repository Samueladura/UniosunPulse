import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService} from '../../services/adminService';
import {supabase} from '../../services/supabase';

const CATEGORIES = [
  'Academic',
  'SUG Event',
  'Security Warning',
  'General Notice',
];

export default function AdminBroadcastAlertScreen({navigation}: any) {
  const [category, setCategory] = useState('Academic');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('admin:broadcast_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        payload => {
          const newAlert = payload.new as any;
          setHistory(prev => [
            {
              id: newAlert.id,
              title: newAlert.title,
              category: newAlert.category,
              time: 'Just now',
              recipients: '14,850 Students',
            },
            ...prev,
          ]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // History log
  const [history, setHistory] = useState([
    {
      id: '1',
      title: 'Matriculation Security & Traffic Advisory',
      category: 'Security Warning',
      time: '2 hours ago',
      recipients: '14,850 Students',
    },
    {
      id: '2',
      title: 'SUG Election Voting Hub Now Open',
      category: 'SUG Event',
      time: 'Yesterday',
      recipients: '14,850 Students',
    },
  ]);

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert(
        'Incomplete Alert',
        'Please provide both a title and notification content.',
      );
      return;
    }

    Alert.alert(
      'Confirm Broadcast',
      `Dispatch push notification "${title}" to all UniOsun registered student devices?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Send Broadcast',
          onPress: async () => {
            setSending(true);
            const sent = await adminService.sendBroadcastAlert(
              isEmergency ? 'EMERGENCY' : category,
              title.trim(),
              body.trim(),
            );
            setSending(false);

            if (sent) {
              setHistory(prev => [
                {
                  id: Date.now().toString(),
                  title: title.trim(),
                  category: isEmergency ? 'EMERGENCY' : category,
                  time: 'Just now',
                  recipients: '14,850 Students',
                },
                ...prev,
              ]);

              setTitle('');
              setBody('');
              setIsEmergency(false);
              Alert.alert(
                'Alert Sent!',
                'Mobile push notification dispatched successfully to all students and published to campus feed.',
              );
            } else {
              Alert.alert(
                'Send Failed',
                'Could not dispatch the broadcast alert. Check the console for details and try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Broadcast Campus Alerts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Send Instant Mobile Alert</Text>
          <Text style={styles.cardSub}>
            Delivered immediately as a push notification and added to student
            alert feeds.
          </Text>

          {/* Emergency Switch */}
          <View style={styles.emergencyRow}>
            <View style={styles.flexOne}>
              <Text style={styles.emergencyTitle}>High-Priority Emergency</Text>
              <Text style={styles.emergencyDesc}>
                Overrides silent mode & highlights alert banner in red.
              </Text>
            </View>
            <Switch
              value={isEmergency}
              onValueChange={setIsEmergency}
              trackColor={{false: colors.switchTrackOff, true: colors.danger}}
              thumbColor={colors.white}
            />
          </View>

          {/* Category Selector */}
          <View style={styles.group}>
            <Text style={styles.label}>Alert Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catBtn,
                    category === cat && !isEmergency && styles.activeCatBtn,
                  ]}
                  disabled={isEmergency}
                  onPress={() => setCategory(cat)}>
                  <Text
                    style={[
                      styles.catBtnText,
                      category === cat &&
                        !isEmergency &&
                        styles.activeCatBtnText,
                    ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title */}
          <View style={styles.group}>
            <Text style={styles.label}>Alert Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Urgent Campus Security Notice"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Body */}
          <View style={styles.group}>
            <Text style={styles.label}>Notification Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write concise notice for mobile notification screen..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={body}
              onChangeText={setBody}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, isEmergency && styles.sendBtnEmergency]}
            disabled={sending}
            onPress={handleSendBroadcast}>
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Icon name="send" size={18} color={colors.white} />
                <Text style={styles.sendBtnText}>
                  {isEmergency
                    ? 'DISPATCH EMERGENCY ALERT'
                    : 'Send Broadcast Alert'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History Stream */}
        <Text style={styles.sectionTitle}>Recent Broadcast History</Text>
        <View style={styles.historyBox}>
          {history.map(item => (
            <View key={item.id} style={styles.historyRow}>
              <View
                style={[
                  styles.historyIcon,
                  item.category === 'EMERGENCY' ||
                  item.category === 'Security Warning'
                    ? styles.historyIconEmergency
                    : styles.historyIconNormal,
                ]}>
                <Icon
                  name={
                    item.category === 'EMERGENCY' ||
                    item.category === 'Security Warning'
                      ? 'shield-off'
                      : 'bell'
                  }
                  size={16}
                  color={
                    item.category === 'EMERGENCY' ||
                    item.category === 'Security Warning'
                      ? colors.danger
                      : colors.primary
                  }
                />
              </View>

              <View style={styles.flexOne}>
                <Text style={styles.historyTitle}>{item.title}</Text>
                <Text style={styles.historyMeta}>
                  {item.category} • {item.recipients}
                </Text>
              </View>
              <Text style={styles.historyTime}>{item.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
    fontSize: 20,
  },
  flexOne: {flex: 1},
  historyIconEmergency: {backgroundColor: '#FEE2E2'},
  historyIconNormal: {backgroundColor: '#DCFCE7'},

  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardHeading: {
    ...typography.h3,
    fontSize: 17,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.small,
    color: colors.textSecondary,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
  },
  emergencyDesc: {
    fontSize: 11,
    color: '#991B1B',
  },
  group: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  activeCatBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeCatBtnText: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  sendBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  sendBtnEmergency: {
    backgroundColor: colors.danger,
  },
  sendBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  historyBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  historyTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
