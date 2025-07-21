import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Crop, getCrops } from '../services/cropDatabase';

type RootStackParamList = {
  Main: undefined;
  TaskDetails: { taskId: string };
  Settings: undefined;
  CropEdit: { cropId: string };
};

type CropsListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CropEdit'>;

export const CropsListScreen: React.FC = () => {
  const navigation = useNavigation<CropsListScreenNavigationProp>();
  const [crops, setCrops] = useState<Crop[]>([]);

  const loadCrops = async () => {
    try {
      const loadedCrops = await getCrops();
      setCrops(loadedCrops);
    } catch (error) {
      console.error('Error loading crops:', error);
      Alert.alert('Error', 'Failed to load crops');
    }
  };

  // Use useFocusEffect to reload crops when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadCrops();
    }, [])
  );

  const handleAddCrop = () => {
    navigation.navigate('CropEdit', { cropId: 'new' });
  };

  const handleEditCrop = (cropId: string) => {
    navigation.navigate('CropEdit', { cropId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Crops</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCrop}>
          <View style={styles.addButtonContent}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Crop</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
          <Text style={[styles.headerCell, styles.numberCell]}>Weeks Before Frost</Text>
          <Text style={[styles.headerCell, styles.numberCell]}>Days to Maturity</Text>
        </View>

        {crops.map((crop) => (
          <TouchableOpacity
            key={crop.id}
            style={styles.tableRow}
            onPress={() => handleEditCrop(crop.id)}
          >
            <Text style={[styles.cell, styles.nameCell]}>{crop.name}</Text>
            <Text style={[styles.cell, styles.numberCell]}>{crop.weeksBeforeFrost}</Text>
            <Text style={[styles.cell, styles.numberCell]}>{crop.daysToMaturity}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 12,
  },
  headerCell: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cell: {
    fontSize: 16,
    color: '#333333',
  },
  nameCell: {
    flex: 2,
  },
  numberCell: {
    flex: 1,
    textAlign: 'center',
  },
}); 