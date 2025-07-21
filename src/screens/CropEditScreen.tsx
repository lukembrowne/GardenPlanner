import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Crop, getCropById, createCrop, updateCrop, deleteCrop, calculatePlantingDate } from '../services/cropDatabase';
import { getTasksByCropId, updateTask } from '../services/database';
import { getSettings } from '../services/settings';
import { format, parse } from 'date-fns';

type RootStackParamList = {
  Main: undefined;
  TaskDetails: { taskId: string };
  Settings: undefined;
  CropEdit: { cropId: string };
};

type CropEditScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CropEdit'>;
type CropEditScreenRouteProp = RouteProp<RootStackParamList, 'CropEdit'>;

export const CropEditScreen: React.FC = () => {
  const navigation = useNavigation<CropEditScreenNavigationProp>();
  const route = useRoute<CropEditScreenRouteProp>();
  const { cropId } = route.params;
  const isNewCrop = cropId === 'new';

  const [crop, setCrop] = useState<Partial<Crop>>({
    name: '',
    weeksBeforeFrost: 0,
    daysToMaturity: 0,
  });
  const [originalWeeksBeforeFrost, setOriginalWeeksBeforeFrost] = useState<number | null>(null);

  useEffect(() => {
    if (!isNewCrop) {
      loadCrop();
    }
  }, [cropId]);

  const loadCrop = async () => {
    try {
      const loadedCrop = await getCropById(cropId);
      if (loadedCrop) {
        setCrop(loadedCrop);
        setOriginalWeeksBeforeFrost(loadedCrop.weeksBeforeFrost);
      }
    } catch (error) {
      console.error('Error loading crop:', error);
      Alert.alert('Error', 'Failed to load crop details');
      navigation.goBack();
    }
  };

  const handleWeeksBeforeFrostChange = async (text: string) => {
    const newValue = parseInt(text) || 0;
    setCrop(prev => ({ ...prev, weeksBeforeFrost: newValue }));

    // If this is an existing crop and the value has changed
    if (!isNewCrop && originalWeeksBeforeFrost !== null && newValue !== originalWeeksBeforeFrost) {
      const tasks = await getTasksByCropId(cropId);
      
      if (tasks.length > 0) {
        Alert.alert(
          'Update Related Tasks',
          `This change will affect ${tasks.length} task${tasks.length === 1 ? '' : 's'}. Would you like to update all related tasks to the new planting date?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                // Revert the weeksBeforeFrost change
                setCrop(prev => ({ ...prev, weeksBeforeFrost: originalWeeksBeforeFrost }));
              },
            },
            {
              text: 'Update Tasks',
              onPress: async () => {
                try {
                  const settings = await getSettings();
                  const frostEndDate = parse(settings.frostEndDate, 'MM-dd', new Date());
                  
                  // Update each task
                  for (const task of tasks) {
                    const newDate = calculatePlantingDate(
                      { ...crop, weeksBeforeFrost: newValue } as Crop,
                      frostEndDate
                    );
                    
                    await updateTask(task.id, {
                      date: format(newDate, 'MM/dd/yyyy'),
                      year: newDate.getFullYear(),
                    });
                  }
                  
                  Alert.alert(
                    'Success',
                    `Updated ${tasks.length} task${tasks.length === 1 ? '' : 's'}`
                  );
                } catch (error) {
                  console.error('Error updating tasks:', error);
                  Alert.alert('Error', 'Failed to update related tasks');
                }
              },
            },
          ]
        );
      }
    }
  };

  const handleSave = async () => {
    if (!crop.name || crop.weeksBeforeFrost === undefined || crop.daysToMaturity === undefined) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      if (isNewCrop) {
        await createCrop(crop as Omit<Crop, 'id'>);
      } else {
        await updateCrop(cropId, crop as Partial<Crop>);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving crop:', error);
      Alert.alert('Error', 'Failed to save crop');
    }
  };

  const handleDelete = async () => {
    if (!isNewCrop) {
      Alert.alert(
        'Delete Crop',
        'Are you sure you want to delete this crop?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCrop(cropId);
                navigation.goBack();
              } catch (error) {
                console.error('Error deleting crop:', error);
                Alert.alert('Error', 'Failed to delete crop');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={crop.name}
            onChangeText={(text) => setCrop({ ...crop, name: text })}
            placeholder="Enter crop name"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Weeks Before Frost *</Text>
          <TextInput
            style={styles.input}
            value={crop.weeksBeforeFrost?.toString()}
            onChangeText={handleWeeksBeforeFrostChange}
            placeholder="Enter weeks before frost"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Days to Maturity *</Text>
          <TextInput
            style={styles.input}
            value={crop.daysToMaturity?.toString()}
            onChangeText={(text) => setCrop({ ...crop, daysToMaturity: parseInt(text) || 0 })}
            placeholder="Enter days to maturity"
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>
            {isNewCrop ? 'Create Crop' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        {!isNewCrop && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Crop</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF5252',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 