/**
 * Devices screen — paired device management with revoke confirmation.
 * Per react-native-ui-ux-plan.md §4G (Devices section).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { Smartphone, Trash2, RefreshCw, Check } from 'lucide-react-native';

interface Device {
  id: string;
  name: string;
  address: string;
  lastSeen: string;
  isOnline: boolean;
}

const MOCK_DEVICES: Device[] = [
  {
    id: 'dev_1',
    name: 'iPad Pro',
    address: '192.168.1.15',
    lastSeen: '2 minutes ago',
    isOnline: true,
  },
  {
    id: 'dev_2',
    name: 'Pixel 8',
    address: '192.168.1.22',
    lastSeen: '1 hour ago',
    isOnline: false,
  },
];

export default function DevicesScreen() {
  const handleRevoke = (device: Device) => {
    Alert.alert(
      'Revoke device?',
      `This will remove "${device.name}" from trusted devices. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            // In production: call /api/revoke/{device_id}
            console.log('Revoke', device.id);
          },
        },
      ],
    );
  };

  const renderDevice = (device: Device) => (
    <View key={device.id} style={styles.deviceCard}>
      <View style={styles.deviceInfo}>
        <View style={[styles.deviceIcon, device.isOnline && styles.deviceIconOnline]}>
          <Smartphone color={device.isOnline ? colors.local : colors.textMuted} size={20} strokeWidth={1.5} />
        </View>
        <View>
          <Text style={styles.deviceName}>{device.name}</Text>
          <Text style={styles.deviceAddress}>{device.address}</Text>
          <Text style={styles.deviceStatus}>
            {device.isOnline ? 'Online' : `Last seen ${device.lastSeen}`}
          </Text>
        </View>
      </View>
      <View style={styles.deviceActions}>
        {device.isOnline && (
          <TouchableOpacity
            style={styles.deviceActionBtn}
            accessible
            accessibilityLabel="Refresh heartbeat"
          >
            <RefreshCw color={colors.accent} size={16} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deviceActionBtn}
          onPress={() => handleRevoke(device)}
          accessible
          accessibilityLabel={`Revoke ${device.name}`}
        >
          <Trash2 color={colors.danger} size={16} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Paired Devices</Text>
        <Text style={styles.subtitle}>
          {MOCK_DEVICES.filter((d) => d.isOnline).length} online, {MOCK_DEVICES.length} total
        </Text>
      </View>

      <View style={styles.list}>
        {MOCK_DEVICES.map(renderDevice)}
      </View>

      {MOCK_DEVICES.length === 0 && (
        <View style={styles.empty}>
          <Smartphone color={colors.textMuted} size={48} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No paired devices</Text>
          <Text style={styles.emptyDesc}>Pair your first device from the James desktop app.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceIconOnline: {
    borderColor: colors.local,
  },
  deviceName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  deviceAddress: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  deviceStatus: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  deviceActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
});
