/**
 * FilterSheet — bottom sheet for selecting a filter.
 * Uses @gorhom/bottom-sheet per react-native-ui-ux-plan.md §5.
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { colors, spacing, fontSize, borderRadius, shadow } from '@/theme/tokens';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: readonly string[];
  selected: string;
  onSelect: (filter: string) => void;
}

export function FilterSheet({ visible, onClose, filters, selected, onSelect }: FilterSheetProps) {
  const snapPoints = useMemo(() => ['30%'], []);

  if (!visible) return null;

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      handleStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.indicator}
      keyboardBehavior="interactive"
    >
      <View style={styles.content}>
        <Text style={styles.title}>Filter results</Text>
        {filters.map((filter) => {
          const isActive = filter === selected;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterItem, isActive && styles.filterItemActive]}
              onPress={() => {
                onSelect(filter);
                onClose();
              }}
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{filter}</Text>
              {isActive && <View style={styles.checkmark} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  handle: { display: 'none' },
  indicator: { backgroundColor: colors.border, width: 40, height: 4 },
  sheetBackground: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg },
  content: { padding: spacing.md, gap: spacing.xs },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterItemActive: { backgroundColor: `${colors.accent}10` },
  filterLabel: { fontSize: fontSize.base, color: colors.text },
  filterLabelActive: { color: colors.accent, fontWeight: '600' },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
});
