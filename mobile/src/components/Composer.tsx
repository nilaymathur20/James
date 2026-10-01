/**
 * Composer — the one-box command input at the bottom of the Ask screen.
 * Includes multiline text, push-to-talk mic, send button, and suggestion
 * chips. Draft is synced to the Zustand composerStore for persistence.
 * Per react-native-ui-ux-plan.md §4A.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
  ViewStyle,
  TextStyle,
  TextStyle as TextStyleType,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { Send, Mic, MicOff, Paperclip } from 'lucide-react-native';
import { useComposerStore } from '@/stores/composerStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

export interface SuggestionChip {
  id: string;
  label: string;
  prompt: string;
}

const DEFAULT_SUGGESTIONS: SuggestionChip[] = [
  { id: 'search', label: 'Search my files', prompt: 'Search my files for' },
  { id: 'index', label: 'Index a folder', prompt: 'Index the folder' },
  { id: 'preview', label: 'Preview a file', prompt: 'Preview the file' },
  { id: 'activity', label: 'Review recent activity', prompt: 'Show me recent activity' },
];

interface ComposerProps {
  onSubmit: (text: string, options?: { source?: 'typed' | 'voice' }) => void;
  onSuggestionPress?: (chip: SuggestionChip) => void;
  disabled?: boolean;
  maxSuggestions?: number;
}

export function Composer({
  onSubmit,
  onSuggestionPress,
  disabled = false,
  maxSuggestions = 4,
}: ComposerProps) {
  const { draft, setDraft, clearDraft } = useComposerStore();
  const { reducedMotion } = usePreferencesStore();
  const [inputHeight, setInputHeight] = useState(44);
  const inputRef = useRef<TextInput>(null);
  const maxInputHeight = 120;

  // Sync draft from store to local state and vice-versa
  const [localDraft, setLocalDraft] = useState(draft);
  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  const onDraftChange = useCallback(
    (text: string) => {
      setLocalDraft(text);
      setDraft(text);
    },
    [setDraft],
  );

  const handleSend = useCallback(() => {
    const trimmed = localDraft.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, { source: 'typed' });
    clearDraft();
    setLocalDraft('');
    setInputHeight(44);
    Keyboard.dismiss();
  }, [localDraft, disabled, onSubmit, clearDraft]);

  const handleSuggestion = useCallback(
    (chip: SuggestionChip) => {
      if (onSuggestionPress) {
        onSuggestionPress(chip);
        return;
      }
      setLocalDraft(chip.prompt);
      setDraft(chip.prompt);
      inputRef.current?.focus();
    },
    [onSuggestionPress, setDraft],
  );

  const handleVoicePress = useCallback(() => {
    // Voice is handled via the VoiceScreen / push-to-talk modal.
    // This button navigates or triggers recording via props.
    console.log('voice pressed');
  }, []);

  const handleContentSizeChange = useCallback(
    (_: unknown, contentHeight: number) => {
      const newHeight = Math.min(Math.max(44, contentHeight + 16), maxInputHeight);
      setInputHeight(newHeight);
    },
    [],
  );

  const sendMessageFromChip = (text: string) => {
    if (!text.trim() || disabled) return;
    onSubmit(text, { source: 'typed' });
    clearDraft();
    setLocalDraft('');
    setInputHeight(44);
  };

  const renderSuggestion = ({ item }: { item: SuggestionChip }) => (
    <TouchableOpacity
      style={styles.suggestionChip}
      onPress={() => sendMessageFromChip(item.prompt)}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <Text style={styles.suggestionLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Suggestion chips */}
      <View style={styles.suggestionsWrapper}>
        <FlatList
          data={DEFAULT_SUGGESTIONS.slice(0, maxSuggestions)}
          keyExtractor={(item) => item.id}
          renderItem={renderSuggestion}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsList}
          keyboardShouldPersistTaps="always"
        />
      </View>

      {/* Input row */}
      <View style={[styles.inputRow, { maxHeight: inputHeight + 20 }]}>
        <Paperclip color={colors.textMuted} size={20} strokeWidth={1.5} style={styles.iconBtn} />

        <TextInput
          ref={inputRef}
          style={[styles.input, { height: inputHeight }]}
          value={localDraft}
          onChangeText={onDraftChange}
          placeholder="Ask James about your files, index a folder, or preview something…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={20000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
          onContentSizeChange={handleContentSizeChange as unknown as (event: unknown) => void}
          editable={!disabled}
          accessible={true}
          accessibilityLabel="Ask James a question"
          accessibilityRole="text"
        />

        {localDraft.trim().length > 0 ? (
          <TouchableOpacity
            style={[styles.sendButton, disabled && styles.sendButtonDisabled, shadow.sm]}
            onPress={handleSend}
            disabled={disabled}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Send color={disabled ? colors.textMuted : colors.local} size={20} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, shadow.sm]}
            onPress={handleVoicePress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Voice input"
          >
            <Mic color={colors.textMuted} size={20} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8, // safe-area breathing room
    backgroundColor: colors.surface,
  },
  suggestionsWrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  suggestionsList: {
    gap: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  iconBtn: {
    opacity: 0.5,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.local}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  },
});
