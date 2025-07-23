import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getSettings, saveSettings, copyYearSchedule, initSettingsTable } from '../services/settings';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { registerForPushNotifications, scheduleWeeklyNotification, cancelAllNotifications, scheduleTestNotification } from '../services/notifications';
import { format, parse } from 'date-fns';

type RootStackParamList = {
  SettingsScreen: undefined;
  ImportExport: undefined;
  Backup: undefined;
  NewYearSetup: { currentYear: number };
};

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SettingsScreen'>;

interface GardenSettings {
  frostStartDate: string;
  frostEndDate: string;
  currentYear: number;
  notificationsEnabled: boolean;
  saveToPhotoLibrary: boolean;
}

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [settings, setSettings] = useState<GardenSettings>({
    frostStartDate: '10-15',
    frostEndDate: '04-15',
    currentYear: new Date().getFullYear(),
    notificationsEnabled: true,
    saveToPhotoLibrary: false,
  });
  const [showFrostStartPicker, setShowFrostStartPicker] = useState(false);
  const [showFrostEndPicker, setShowFrostEndPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    setupSettings();
  }, []);

  const setupSettings = async () => {
    try {
      // Initialize settings table first
      await initSettingsTable();
      // Then load settings
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error setting up settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleCopyYear = async () => {
    const fromYear = settings.currentYear - 1;
    try {
      await copyYearSchedule(fromYear, settings.currentYear);
      Alert.alert('Success', `Copied schedule from ${fromYear} to ${settings.currentYear}`);
    } catch (error) {
      console.error('Error copying year schedule:', error);
      Alert.alert('Error', 'Failed to copy year schedule');
    }
  };

  const formatDate = (dateString: string) => {
    // Convert from MM-DD to MM/DD/YYYY format for parsing
    const [month, day] = dateString.split('-');
    const dateForParsing = `${month}/${day}/2000`; // Use 2000 as a base year
    
    const parsedDate = parse(dateForParsing, 'MM/dd/yyyy', new Date());
    return format(parsedDate, 'MMMM d'); // Format as "Month Day"
  };

  const openDatePicker = (isFrostStart: boolean) => {
    const dateStr = isFrostStart ? settings.frostStartDate : settings.frostEndDate;
    const [month, day] = dateStr.split('-');
    const initialDate = parse(`${month}/${day}/2000`, 'MM/dd/yyyy', new Date());
    setTempDate(initialDate);
    if (isFrostStart) {
      setShowFrostStartPicker(true);
    } else {
      setShowFrostEndPicker(true);
    }
  };

  const handleDateChange = (date: Date) => {
    setTempDate(date);
  };

  const handleDateSave = async (isFrostStart: boolean) => {
    try {
      const month = (tempDate.getMonth() + 1).toString().padStart(2, '0');
      const day = tempDate.getDate().toString().padStart(2, '0');
      const dateString = `${month}-${day}`;
      
      // Update local state
      const newSettings = {
        ...settings,
        [isFrostStart ? 'frostStartDate' : 'frostEndDate']: dateString,
      };
      setSettings(newSettings);
      
      // Save to database immediately
      await saveSettings(newSettings);
      
      // Close the modal
      if (isFrostStart) {
        setShowFrostStartPicker(false);
      } else {
        setShowFrostEndPicker(false);
      }
    } catch (error) {
      console.error('Error saving frost date:', error);
      Alert.alert('Error', 'Failed to save frost date. Please try again.');
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    try {
      if (value) {
        // Enable notifications
        const token = await registerForPushNotifications();
        if (token) {
          await scheduleWeeklyNotification();
          setSettings(prev => ({ ...prev, notificationsEnabled: true }));
        } else {
          Alert.alert('Error', 'Failed to enable notifications. Please check your device settings.');
          return;
        }
      } else {
        // Disable notifications
        await cancelAllNotifications();
        setSettings(prev => ({ ...prev, notificationsEnabled: false }));
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frost Dates</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>First Frost Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {formatDate(settings.frostStartDate)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Last Frost Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openDatePicker(false)}
          >
            <Text style={styles.dateButtonText}>
              {formatDate(settings.frostEndDate)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Year Management</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Current Planting Year</Text>
          <TextInput
            style={styles.input}
            value={settings.currentYear.toString()}
            onBlur={async () => {
              // Save when user finishes editing
              const year = parseInt(settings.currentYear.toString());
              if (!isNaN(year) && year >= 1900 && year <= 2100) {
                try {
                  await saveSettings(settings);
                } catch (error) {
                  console.error('Error saving year setting:', error);
                  Alert.alert('Error', 'Failed to save year setting');
                }
              }
            }}
            onChangeText={(text) => {
              // Only update local state while typing
              const year = parseInt(text);
              if (!isNaN(year) || text === '') {
                setSettings(prev => ({ ...prev, currentYear: year || new Date().getFullYear() }));
              }
            }}
            keyboardType="numeric"
          />
          <Text style={styles.helpText}>
            Changes to the year are saved automatically. This controls which year's tasks are shown in the main screen.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopyYear}
        >
          <Text style={styles.copyButtonText}>
            Copy Schedule from Previous Year
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newYearButton}
          onPress={() => navigation.navigate('NewYearSetup', { currentYear: settings.currentYear })}
        >
          <Text style={styles.newYearButtonText}>
            🎯 New Year Setup (Advanced)
          </Text>
        </TouchableOpacity>
      </View>


      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.notificationContainer}>
          <Text style={styles.label}>Weekly Task Reminders</Text>
          <Text style={styles.helpText}>Receive a weekly summary of upcoming tasks every Sunday at 9 AM</Text>
          <View style={styles.switchContainer}>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.notificationsEnabled ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { marginTop: 10 }]}
          onPress={async () => {
            const success = await scheduleTestNotification();
            if (success) {
              Alert.alert('Success', 'Test notification scheduled for 1 minute from now');
            } else {
              Alert.alert('Error', 'Failed to schedule test notification');
            }
          }}
        >
          <Text style={styles.buttonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photo Settings</Text>
        
        <View style={styles.notificationContainer}>
          <Text style={styles.label}>Save to Photo Library</Text>
          <Text style={styles.helpText}>Automatically save photos to your device's photo library when taking pictures</Text>
          <View style={styles.switchContainer}>
            <Switch
              value={settings.saveToPhotoLibrary}
              onValueChange={async (value) => {
                try {
                  const newSettings = { ...settings, saveToPhotoLibrary: value };
                  setSettings(newSettings);
                  await saveSettings(newSettings);
                } catch (error) {
                  console.error('Error updating photo library setting:', error);
                  Alert.alert('Error', 'Failed to update photo library setting');
                }
              }}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={settings.saveToPhotoLibrary ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        {/* <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('ImportExport')}
        >
          <Text style={styles.buttonText}>Import/Export Tasks</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Backup')}
        >
          <Text style={styles.buttonText}>Database Backup</Text>
        </TouchableOpacity>
      </View>

      {/* <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity> */}

      {/* Date Picker Modals */}
      <Modal
        visible={showFrostStartPicker}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select First Frost Date</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(_, date) => date && handleDateChange(date)}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFrostStartPicker(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => handleDateSave(true)}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFrostEndPicker}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Last Frost Date</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(_, date) => date && handleDateChange(date)}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFrostEndPicker(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => handleDateSave(false)}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  copyButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  newYearButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  newYearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mainSaveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationContainer: {
    marginVertical: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 5,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginBottom: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 