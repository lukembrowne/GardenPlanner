import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { exportDatabase, importDatabase } from '../services/databaseBackup';
import * as FileSystem from 'expo-file-system';

type RootStackParamList = {
  Main: undefined;
  TaskDetails: { taskId: string };
  Settings: undefined;
  Backup: undefined;
};

type BackupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Backup'>;

export const BackupScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<BackupScreenNavigationProp>();

  const handleExport = async () => {
    try {
      setIsLoading(true);
      await exportDatabase();
      Alert.alert('Success', 'Database backup created and shared successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to create backup: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsLoading(true);
      console.log('Starting import process...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
      });

      if (result.canceled) {
        console.log('Import cancelled by user');
        setIsLoading(false);
        return;
      }

      const fileName = result.assets[0].name;
      console.log('Selected file:', {
        name: fileName,
        uri: result.assets[0].uri,
        size: result.assets[0].size
      });

      if (!fileName.toLowerCase().endsWith('.json')) {
        console.log('Invalid file type selected:', fileName);
        Alert.alert('Error', 'Please select a valid backup file (.json)');
        setIsLoading(false);
        return;
      }

      // Verify the file exists and is accessible
      const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
      console.log('File info:', {
        exists: fileInfo.exists,
        uri: fileInfo.uri,
        isDirectory: fileInfo.isDirectory
      });

      if (!fileInfo.exists) {
        throw new Error('Selected file does not exist or is not accessible');
      }

      // Read and validate the JSON file
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      try {
        const backup = JSON.parse(fileContent);
        if (!backup.version || !backup.timestamp || !backup.data) {
          throw new Error('Invalid backup file format');
        }
      } catch (parseError) {
        console.error('JSON validation error:', parseError);
        Alert.alert('Error', 'Invalid backup file format. Please select a valid GardenPlanner backup file.');
        setIsLoading(false);
        return;
      }

      Alert.alert(
        'Confirm Import',
        'This will replace your current database with the backup. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('Import cancelled by user');
              setIsLoading(false);
            },
          },
          {
            text: 'Import',
            onPress: async () => {
              try {
                console.log('Starting database import...');
                await importDatabase(result.assets[0].uri);
                console.log('Database import completed successfully');
                Alert.alert('Success', 'Database restored successfully!');
                navigation.navigate('Main');
              } catch (error) {
                console.error('Import error:', error);
                Alert.alert(
                  'Import Failed',
                  'Failed to restore backup. Please check the console for details.'
                );
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(
        'Error',
        'Failed to select backup file. Please check the console for details.'
      );
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Database Backup</Text>
          
          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>Instructions:</Text>
            <Text style={styles.helpText}>• Export: Creates a backup of your database and shares it</Text>
            <Text style={styles.helpText}>• Import: Restores a previously created backup</Text>
            <Text style={styles.helpText}>• Warning: Importing will replace your current database</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={handleExport}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Export Database</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleImport}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Import Database</Text>
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  helpContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginBottom: 30,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    width: '80%',
    marginVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 