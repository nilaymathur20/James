/**
 * Connection screen — first-run pairing / backend URL configuration.
 * Per react-native-ui-ux-plan.md §4 (mobile connection model).
 * Three options: local computer (enter address), paired device, demo mode.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { Wifi, QrCode, Smartphone } from 'lucide-react-native';
import { useSessionStore } from '@/stores/sessionStore';
import { fetchHealth, setApiBaseUrl } from '@/services/apiClient';
import { useRouter } from 'expo-router';

export default function ConnectionScreen() {
  const router = useRouter();
  const { saveBackendUrl, status, setError: _setError } = useSessionStore();
  const [customUrl, setCustomUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    const url = customUrl.trim() || 'http://127.0.0.1:8000';
    if (!url) return;

    setIsConnecting(true);
    try {
      setApiBaseUrl(url);
      const health = await fetchHealth();
      if (health) {
        await saveBackendUrl(url);
        Alert.alert('Connected', 'James backend is reachable.');
        router.back();
      }
    } catch (err: unknown) {
      Alert.alert('Connection failed', err instanceof Error ? err.message : 'Unable to reach backend.');
    } finally {
      setIsConnecting(false);
    }
  }, [customUrl, saveBackendUrl, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Connect to James</Text>
        <Text style={styles.subtitle}>
          James runs locally on your computer. Enter its address below.
        </Text>

        {/* Option 1: Local computer */}
        <View style={styles.option}>
          <View style={styles.optionHeader}>
            <Wifi color={colors.local} size={24} strokeWidth={1.5} />
            <Text style={styles.optionTitle}>Local computer on same Wi-Fi</Text>
          </View>
          <Text style={styles.optionDesc}>
            Enter the HTTP address of your James backend (e.g. http://192.168.1.10:8000).
            The backend should remain bound to a trusted interface.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="http://192.168.1.10:8000"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.connectBtn, isConnecting && styles.connecting, shadow.sm]}
              onPress={handleConnect}
              disabled={isConnecting}
            >
              <Text style={styles.connectBtnText}>{isConnecting ? '…' : 'Connect'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Option 2: Paired device */}
        <View style={styles.option}>
          <View style={styles.optionHeader}>
            <Smartphone color={colors.accent} size={24} strokeWidth={1.5} />
            <Text style={styles.optionTitle}>Paired device</Text>
          </View>
          <Text style={styles.optionDesc}>
            Pair using a QR code or PIN handshake from the James desktop app.
          </Text>
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => Alert.alert('Scan QR', 'Open the camera and scan a James pairing QR code.')}
          >
            <QrCode color={colors.accent} size={20} strokeWidth={1.5} />
            <Text style={styles.qrBtnText}>Scan pairing code</Text>
          </TouchableOpacity>
        </View>

        {/* Option 3: Demo mode */}
        <View style={styles.option}>
          <View style={styles.optionHeader}>
            <Wifi color={colors.textMuted} size={24} strokeWidth={1.5} />
            <Text style={styles.optionTitle}>Demo mode</Text>
          </View>
          <Text style={styles.optionDesc}>
            Explore the interface with mock data. No backend required.
          </Text>
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              // Demo mode: no backend URL set, Ask screen uses mock transport
              router.back();
            }}
          >
            <Text style={styles.demoBtnText}>Continue in demo mode</Text>
          </TouchableOpacity>
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
  content: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  option: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  optionDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.text,
    height: 48,
  },
  connectBtn: {
    backgroundColor: colors.local,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 90,
    alignItems: 'center',
  },
  connecting: {
    opacity: 0.6,
  },
  connectBtnText: {
    color: colors.background,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrBtnText: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  demoBtn: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  demoBtnText: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontWeight: '600',
  },
});
