/**
 * SearchBar — compact search input with filter button.
 * Used in Library and Activity screens.
 */
import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/theme/tokens';
import { Search, Filter } from 'lucide-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  activeFilter?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onFilterPress,
  activeFilter,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <Search color={colors.textMuted} size={16} strokeWidth={1.5} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessible
          accessibilityLabel="Search files"
        />
      </View>
      {onFilterPress && (
        <TouchableOpacity
          style={[styles.filterBtn, activeFilter && activeFilter !== 'All' && styles.filterActive]}
          onPress={onFilterPress}
          accessible
          accessibilityLabel="Filter"
          accessibilityRole="button"
        >
          <Filter color={activeFilter && activeFilter !== 'All' ? colors.accent : colors.textMuted} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    height: 44,
    minHeight: 44,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: {
    backgroundColor: `${colors.accent}20`,
    borderColor: colors.accent,
  },
});
