/**
 * File edit screen — shows a text editor for creating an edit proposal.
 * Per react-native-ui-ux-plan.md §4D step 1 (Create proposal).
 * The user enters old_text and new_text, then proceeds to the diff review.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFilePreview, useProposeEdit } from '@/features/files/fileService';
import { ActivityIndicator } from '@/components/ActivityIndicator';

export default function FileEditScreen() {
  const router = useRouter();
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const { data: previewData, isLoading, isError } = useFilePreview(fileId, true);
  const proposeEditMutation = useProposeEdit();

  const [oldText, setOldText] = useState('');
  const [newText, setNewText] = useState('');

  const file = previewData?.file;
  const isEditable = file?.can_edit;

  // Pre-fill oldText with the first line of content as a useful default
  useEffect(() => {
    if (previewData?.content && !oldText) {
      const firstLine = previewData.content.split('\n').find((l) => l.trim().length > 0) || '';
      setOldText(firstLine);
      setNewText(firstLine);
    }
  }, [previewData, oldText]);

  const handleReview = useCallback(async () => {
    if (!oldText.trim()) {
      Alert.alert('Missing old text', 'Please enter the text you want to replace.');
      return;
    }
    if (!newText) {
      Alert.alert('Empty replacement', 'The new text cannot be empty.');
      return;
    }

    try {
      const result = await proposeEditMutation.mutateAsync({
        file_id: fileId,
        old_text: oldText,
        new_text: newText,
      });

      if (result.status === 'proposal_ready' && result.proposal_id) {
        // Navigate to the diff review screen with the proposal ID
        router.push(`/file/${fileId}/edit-review?proposalId=${result.proposal_id}`);
      } else if (result.requires_confirmation) {
        Alert.alert('Review needed', result.message || 'Please review the edit before applying.');
      }
    } catch (err: unknown) {
      Alert.alert(
        'Could not create proposal',
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      );
    }
  }, [oldText, newText, fileId, proposeEditMutation, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}><ActivityIndicator /></SafeAreaView>
    );
  }

  if (isError || !file) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.error}>File not found or not editable.</Text>
      </SafeAreaView>
    );
  }

  if (!isEditable) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.error}>This file type cannot be edited through the assistant.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* File header */}
      <View style={styles.header}>
        <Text style={styles.fileName}>{file.name}</Text>
        <Text style={styles.fileStatus}>Editable · Indexed</Text>
      </View>

      {/* Text inputs */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Find (old text)</Text>
        <TextInput
          style={[styles.textInput, styles.oldTextInput]}
          value={oldText}
          onChangeText={setOldText}
          placeholder="Text to find in the file"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Replace with (new text)</Text>
        <TextInput
          style={[styles.textInput, styles.newTextInput]}
          value={newText}
          onChangeText={setNewText}
          placeholder="New text to replace it with"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Preview hint */}
      {previewData?.content && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Current file content shown for reference. Your old_text must match exactly.
          </Text>
        </View>
      )}

      {/* Review button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.reviewBtn, proposeEditMutation.isPending && styles.reviewBtnDisabled, shadow.sm]}
          onPress={handleReview}
          disabled={proposeEditMutation.isPending || !oldText.trim()}
        >
          <ActivityIndicator loading={proposeEditMutation.isPending} />
          <Text style={styles.reviewBtnText}>
            {proposeEditMutation.isPending ? '' : 'Review edit →'}
          </Text>
        </TouchableOpacity>
      </View>
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
  fileName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  fileStatus: {
    fontSize: fontSize.xs,
    color: colors.local,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  textInput: {
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    maxHeight: 200,
    fontFamily: 'monospace',
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  oldTextInput: {
    borderColor: colors.danger,
  },
  newTextInput: {
    borderColor: colors.local,
  },
  hint: {
    backgroundColor: `${colors.accent}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.local,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    height: 48,
  },
  reviewBtnDisabled: {
    opacity: 0.5,
  },
  reviewBtnText: {
    color: colors.background,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
});
