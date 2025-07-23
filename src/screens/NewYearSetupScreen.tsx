import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  getAvailableYears, 
  copySelectedTasks, 
  getTemplatesByCategory,
  getTasks 
} from '../services/database';
import { TaskCategory, Task } from '../types/Task';

type RootStackParamList = {
  SettingsScreen: undefined;
  NewYearSetup: { currentYear: number };
};

type NewYearSetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewYearSetup'>;

interface CopyOptions {
  fromYear: number;
  categories: string[];
  includeTemplates: boolean;
  includeNotes: boolean;
  resetCompletion: boolean;
}

export const NewYearSetupScreen: React.FC = () => {
  const navigation = useNavigation<NewYearSetupScreenNavigationProp>();
  const route = useRoute();
  const { currentYear } = route.params as { currentYear: number };
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<Task[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const [copyOptions, setCopyOptions] = useState<CopyOptions>({
    fromYear: currentYear - 1,
    categories: ['seeding', 'maintenance', 'planning'],
    includeTemplates: true,
    includeNotes: false,
    resetCompletion: true,
  });

  const categoryOptions = [
    { value: 'seeding', label: 'Seeding Schedule' },
    { value: 'maintenance', label: 'Maintenance Tasks' },
    { value: 'harvesting', label: 'Harvesting Schedule' },
    { value: 'planning', label: 'Planning Tasks' },
    { value: 'other', label: 'Other Tasks' },
  ];

  useEffect(() => {
    loadAvailableYears();
  }, []);

  const loadAvailableYears = async () => {
    try {
      const years = await getAvailableYears();
      const filteredYears = years.filter(year => year !== currentYear);
      setAvailableYears(filteredYears);
      
      if (filteredYears.length > 0 && !filteredYears.includes(copyOptions.fromYear)) {
        setCopyOptions(prev => ({ ...prev, fromYear: filteredYears[0] }));
      }
    } catch (error) {
      console.error('Error loading years:', error);
      Alert.alert('Error', 'Failed to load available years');
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async () => {
    try {
      setLoading(true);
      const tasks = await getTasks(copyOptions.fromYear);
      
      const filtered = tasks.filter(task => {
        if (copyOptions.categories.length > 0 && copyOptions.categories.includes(task.category || '')) {
          return true;
        }
        if (copyOptions.includeTemplates && task.isTemplate) {
          return true;
        }
        if (copyOptions.includeNotes && task.type === 'note') {
          return true;
        }
        return false;
      });
      
      setPreviewTasks(filtered);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      Alert.alert('Error', 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (availableYears.length === 0) {
      Alert.alert('No Data', 'No previous years found to copy from');
      return;
    }

    Alert.alert(
      'Confirm Copy',
      `Copy ${previewTasks.length} items from ${copyOptions.fromYear} to ${currentYear}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Copy', 
          onPress: performCopy 
        },
      ]
    );
  };

  const performCopy = async () => {
    try {
      setCopying(true);
      
      const copiedCount = await copySelectedTasks({
        fromYear: copyOptions.fromYear,
        toYear: currentYear,
        categories: copyOptions.categories.length > 0 ? copyOptions.categories : undefined,
        includeTemplates: copyOptions.includeTemplates,
        includeNotes: copyOptions.includeNotes,
        resetCompletion: copyOptions.resetCompletion,
      });

      Alert.alert(
        'Success!', 
        `Copied ${copiedCount} items from ${copyOptions.fromYear} to ${currentYear}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error copying tasks:', error);
      Alert.alert('Error', 'Failed to copy tasks');
    } finally {
      setCopying(false);
    }
  };

  const toggleCategory = (category: string) => {
    setCopyOptions(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
    setShowPreview(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading available years...</Text>
      </View>
    );
  }

  if (availableYears.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          No previous years found. Start fresh with your {currentYear} garden planning!
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Set up {currentYear} Garden</Text>
      <Text style={styles.subtitle}>
        Copy tasks and schedules from previous years to get started quickly.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Copy from Year:</Text>
        <TouchableOpacity
          style={styles.yearSelector}
          onPress={() => setShowYearPicker(true)}
        >
          <Text style={styles.yearSelectorText}>{copyOptions.fromYear}</Text>
          <Text style={styles.yearSelectorArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories to Copy:</Text>
        {categoryOptions.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={styles.checkboxRow}
            onPress={() => toggleCategory(value)}
          >
            <View style={[
              styles.checkbox,
              copyOptions.categories.includes(value) && styles.checkboxChecked
            ]}>
              {copyOptions.categories.includes(value) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Include Template Tasks</Text>
          <Switch
            value={copyOptions.includeTemplates}
            onValueChange={(value) => 
              setCopyOptions(prev => ({ ...prev, includeTemplates: value }))
            }
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Include Notes</Text>
          <Switch
            value={copyOptions.includeNotes}
            onValueChange={(value) => 
              setCopyOptions(prev => ({ ...prev, includeNotes: value }))
            }
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Reset Completion Status</Text>
          <Switch
            value={copyOptions.resetCompletion}
            onValueChange={(value) => 
              setCopyOptions(prev => ({ ...prev, resetCompletion: value }))
            }
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.previewButton]}
          onPress={generatePreview}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : 'Preview'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.copyButton, !showPreview && styles.disabledButton]}
          onPress={handleCopy}
          disabled={copying || !showPreview}
        >
          <Text style={styles.buttonText}>
            {copying ? 'Copying...' : `Copy ${previewTasks.length} items`}
          </Text>
        </TouchableOpacity>
      </View>

      {showPreview && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Preview ({previewTasks.length} items):</Text>
          {previewTasks.slice(0, 10).map((task, index) => (
            <View key={task.id} style={styles.previewItem}>
              <Text style={styles.previewTitle}>{task.title}</Text>
              <Text style={styles.previewDetails}>
                {task.category} • {task.type} • {task.date}
              </Text>
            </View>
          ))}
          {previewTasks.length > 10 && (
            <Text style={styles.moreText}>
              ...and {previewTasks.length - 10} more items
            </Text>
          )}
        </View>
      )}

      {/* Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Year to Copy From</Text>
            
            <FlatList
              data={availableYears}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.yearOption,
                    item === copyOptions.fromYear && styles.yearOptionSelected
                  ]}
                  onPress={() => {
                    setCopyOptions(prev => ({ ...prev, fromYear: item }));
                    setShowPreview(false);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[
                    styles.yearOptionText,
                    item === copyOptions.fromYear && styles.yearOptionTextSelected
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.yearList}
            />
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowYearPicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2E7D32',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginVertical: 40,
    lineHeight: 26,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 16,
    minHeight: 50,
  },
  yearSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  yearSelectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewButton: {
    backgroundColor: '#2196F3',
  },
  copyButton: {
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  previewItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  previewDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  moreText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  yearList: {
    maxHeight: 200,
  },
  yearOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 2,
  },
  yearOptionSelected: {
    backgroundColor: '#4CAF50',
  },
  yearOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  yearOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
  },
});