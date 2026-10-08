/**
 * Library screen — indexed roots, search bar, file result cards.
 * Per react-native-ui-ux-plan.md §4B.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '@/theme/tokens';
import { FileCard } from '@/components/FileCard';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { FilterSheet } from '@/components/FilterSheet';
import { useFileSearch } from '@/features/files/fileService';
import type { FileMetadata } from '@/schemas/files';
import { useRouter } from 'expo-router';

const FILTERS = ['All', 'Indexed content', 'Discoverable metadata', 'Recent'] as const;

export default function LibraryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, error } = useFileSearch(query, 20, query.length > 0);
  const results = data?.results || [];

  const handleFilePress = useCallback(
    (file: FileMetadata) => {
      router.push(`/file/${file.file_id}/preview`);
    },
    [router],
  );

  const handlePreview = useCallback(
    (file: FileMetadata) => {
      router.push(`/file/${file.file_id}/preview`);
    },
    [router],
  );

  const handleEdit = useCallback(
    (file: FileMetadata) => {
      router.push(`/file/${file.file_id}/edit`);
    },
    [router],
  );

  const handleOpen = useCallback((file: FileMetadata) => {
    // Would call open_file with confirmed=true
  }, []);

  const renderItem = ({ item }: { item: FileMetadata }) => (
    <FileCard
      file={item}
      onPress={() => handleFilePress(item)}
      onPreview={() => handlePreview(item)}
      onEdit={item.can_edit ? () => handleEdit(item) : undefined}
      onOpen={item.can_open ? () => handleOpen(item) : undefined}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search indexed files…"
          onFilterPress={() => setShowFilters(true)}
          activeFilter={activeFilter}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.file_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="search"
              title="No files found"
              description={
                query
                  ? 'No files match your search. Try different keywords or index a new folder.'
                  : 'Index a folder to make files searchable. Your content stays local.'
              }
            />
          ) : null
        }
        ListFooterComponent={isLoading ? <Text style={styles.loadingText}>Searching local index…</Text> : null}
      />

      {isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Search failed'}</Text>
        </View>
      )}

      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={FILTERS}
        selected={activeFilter}
        onSelect={(f) => {
          setActiveFilter(f);
          setShowFilters(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.sm,
    padding: spacing.md,
  },
  errorBanner: {
    backgroundColor: `${colors.danger}20`,
    padding: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
});
