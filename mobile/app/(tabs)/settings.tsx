/**
 * Settings screen — connection health, providers, voice, devices,
 * privacy, appearance, about. Per react-native-ui-ux-plan.md §4G.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import {
  Wifi,
  Mic,
  Shield,
  Palette,
  Smartphone,
  Info,
  Cloud,
  Database,
} from 'lucide-react-native';
import { useBackendHealth } from '@/features/assistant/connectionService';
import { useSessionStore } from '@/stores/sessionStore';

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}

function SettingItem({ icon, label, value, onPress, destructive = false }: SettingItemProps) {
  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} accessible={true} accessibilityRole="button">
      <View style={styles.settingLeft}>
        {icon}
        <Text style={[styles.settingLabel, destructive && { color: colors.danger }]}>{label}</Text>
      </View>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { backendUrl } = useSessionStore();
  const health = useBackendHealth(!!backendUrl && backendUrl !== '/api');
  const healthData = health.health;

  const connectionLabel =
    health.isOnline ? 'Connected' : health.isOffline ? 'Disconnected' : 'Checking…';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView>
        {/* Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Wifi color={colors.accent} size={20} strokeWidth={1.5} />}
              label="Backend"
              value={connectionLabel}
              onPress={() => router.push('/connection')}
            />
            {healthData?.chat_provider && (
              <SettingItem
                icon={<Cloud color={colors.online} size={20} strokeWidth={1.5} />}
                label="Assistant provider"
                value={healthData.chat_provider || 'None'}
              />
            )}
            {healthData && (
              <SettingItem
                icon={<Database color={colors.local} size={20} strokeWidth={1.5} />}
                label="Indexed chunks"
                value={
                  healthData.indexed_chunks !== undefined
                    ? String(healthData.indexed_chunks)
                    : undefined
                }
              />
            )}
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Shield color={colors.local} size={20} strokeWidth={1.5} />}
              label="Local-first mode"
              value="Active"
              onPress={() => router.push('/privacy')}
            />
            <SettingItem
              icon={<Mic color={colors.accent} size={20} strokeWidth={1.5} />}
              label="Approved roots"
              value={
                healthData?.registered_roots !== undefined
                  ? `${(healthData.registered_roots as unknown[]).length} roots`
                  : undefined
              }
              onPress={() => router.push('/privacy')}
            />
          </View>
        </View>

        {/* Voice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Mic color={colors.online} size={20} strokeWidth={1.5} />}
              label="Voice transcription"
              value={healthData?.voice?.model_configured ? 'Ready' : 'Not configured'}
              onPress={() => router.push('/voice')}
            />
          </View>
        </View>

        {/* Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Devices</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Smartphone color={colors.accent} size={20} strokeWidth={1.5} />}
              label="Paired devices"
              value="0 devices"
              onPress={() => router.push('/devices')}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Palette color={colors.textMuted} size={20} strokeWidth={1.5} />}
              label="Theme"
              value="Dark"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingItem
              icon={<Info color={colors.textMuted} size={20} strokeWidth={1.5} />}
              label="Protocol version"
              value="james.assistant.v1"
            />
            <SettingItem
              icon={<Info color={colors.textMuted} size={20} strokeWidth={1.5} />}
              label="App version"
              value="1.0.0"
            />
          </View>
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
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  settingValue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
