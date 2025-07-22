import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Switch,
  Image,
  FlatList,
  ActionSheetIOS,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Dropdown } from 'react-native-element-dropdown';
import { Task, CreateTaskInput, ItemType } from '../types/Task';
import { createTask, getTaskById, updateTask } from '../services/database';
import { Crop, getCrops, getCropById, calculatePlantingDate } from '../services/cropDatabase';
import { getSettings } from '../services/settings';
import { format, parse, addWeeks } from 'date-fns';
import {
  launchCamera,
  launchImagePicker,
  savePhotoToStorage,
  getPhotoUri,
  deletePhoto,
  cleanupTaskPhotos
} from '../services/photoManager';
import { PhotoLibraryOptions, PhotoSaveResult } from '../types/PhotoLibrary';

type RootStackParamList = {
  Main: undefined;
  TaskDetails: { taskId: string; type?: ItemType };
  Settings: undefined;
};

type TaskDetailsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TaskDetails'>;
type TaskDetailsScreenRouteProp = RouteProp<RootStackParamList, 'TaskDetails'>;

export const TaskDetailsScreen: React.FC = () => {
  const navigation = useNavigation<TaskDetailsScreenNavigationProp>();
  const route = useRoute<TaskDetailsScreenRouteProp>();
  const { taskId, type } = route.params;
  const isNewTask = taskId === 'new';

  const [task, setTask] = useState<Partial<Task>>({
    title: '',
    type: type || 'task',
    date: format(new Date(), 'MM/dd/yyyy'),
    notes: '',
    photos: [],
    year: new Date().getFullYear(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [settings, setSettings] = useState<{ frostEndDate: string } | null>(null);
  const [enableSuccession, setEnableSuccession] = useState(false);
  const [successionInterval, setSuccessionInterval] = useState('2');
  const [successionCount, setSuccessionCount] = useState('4');
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    loadCrops();
    loadSettings();
    if (!isNewTask) {
      loadTask();
    }
  }, [taskId]);

  const loadSettings = async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadCrops = async () => {
    try {
      const loadedCrops = await getCrops();
      setCrops(loadedCrops);
    } catch (error) {
      console.error('Error loading crops:', error);
    }
  };

  const loadTask = async () => {
    try {
      const loadedTask = await getTaskById(taskId);
      setTask(loadedTask);
      if (loadedTask.cropId) {
        const crop = await getCropById(loadedTask.cropId);
        setSelectedCrop(crop);
      }
    } catch (error) {
      console.error('Error loading task:', error);
      Alert.alert('Error', 'Failed to load task details');
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!task.title || !task.date) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const taskToSave = {
        ...task,
        cropId: selectedCrop?.id,
      };

      if (isNewTask) {
        // Save the original task
        await createTask(taskToSave as CreateTaskInput);

        // If succession planting is enabled, create additional tasks
        if (enableSuccession) {
          const interval = parseInt(successionInterval);
          const count = parseInt(successionCount);
          const baseDate = parse(task.date, 'MM/dd/yyyy', new Date());

          for (let i = 1; i < count; i++) {
            const nextDate = addWeeks(baseDate, i * interval);
            const successionTask = {
              ...taskToSave,
              title: `${taskToSave.title} - #${i + 1}`,
              date: format(nextDate, 'MM/dd/yyyy'),
              year: nextDate.getFullYear(),
            };
            await createTask(successionTask as CreateTaskInput);
          }
        }
      } else {
        await updateTask(taskId, taskToSave as Partial<Task>);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setTask({ 
        ...task, 
        date: format(selectedDate, 'MM/dd/yyyy'),
        year: selectedDate.getFullYear()
      });
    }
  };

  const renderDatePicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalButton}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parse(task.date!, 'MM/dd/yyyy', new Date())}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
              />
            </View>
          </View>
        </Modal>
      );
    }

    return showDatePicker && (
      <DateTimePicker
        value={parse(task.date!, 'MM/dd/yyyy', new Date())}
        mode="date"
        display="default"
        onChange={handleDateChange}
      />
    );
  };

  const handleCropSelect = (item: { label: string; value: string }) => {
    const crop = crops.find(c => c.id === item.value) || null;
    setSelectedCrop(crop);

    if (crop && settings) {
      // Set the title to the crop name
      setTask(prev => ({ ...prev, title: crop.name }));

      // Calculate the planting date based on weeksBeforeFrost
      const frostEndDate = parse(settings.frostEndDate, 'MM-dd', new Date());
      console.log('Frost end date:', frostEndDate);
      console.log('Front end date from settings:', settings.frostEndDate);
      const plantingDate = calculatePlantingDate(crop, frostEndDate);
      console.log('Planting date:', plantingDate);
      // Update the date
      setTask(prev => ({
        ...prev,
        date: format(plantingDate, 'MM/dd/yyyy'),
        year: plantingDate.getFullYear()
      }));
    }
  };

  const handleAddPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handlePickPhoto();
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Library', onPress: handlePickPhoto },
        ]
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const settings = await getSettings();
      const options: PhotoLibraryOptions = {
        saveToLibrary: settings.saveToPhotoLibrary
      };
      
      const result = await launchCamera(options);
      if (result) {
        const taskIdForPhoto = task.id || 'temp_' + Date.now();
        const saveResult = await savePhotoToStorage(result.uri, taskIdForPhoto, options);
        
        setTask(prev => ({
          ...prev,
          photos: [...(prev.photos || []), saveResult.uri]
        }));
        
        // Show feedback if photo was saved to library
        if (settings.saveToPhotoLibrary && saveResult.savedToLibrary) {
          Alert.alert('Success', 'Photo saved to camera roll and task');
        } else if (settings.saveToPhotoLibrary && saveResult.libraryError) {
          Alert.alert('Partial Success', `Photo saved to task but failed to save to camera roll: ${saveResult.libraryError}`);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const settings = await getSettings();
      const options: PhotoLibraryOptions = {
        saveToLibrary: false // Photos picked from library don't need to be re-saved
      };
      
      const result = await launchImagePicker(options);
      if (result) {
        const taskIdForPhoto = task.id || 'temp_' + Date.now();
        const saveResult = await savePhotoToStorage(result.uri, taskIdForPhoto);
        
        setTask(prev => ({
          ...prev,
          photos: [...(prev.photos || []), saveResult.uri]
        }));
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  const handleDeletePhoto = (filename: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhoto(filename);
              setTask(prev => ({
                ...prev,
                photos: (prev.photos || []).filter(photo => photo !== filename)
              }));
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo');
            }
          }
        }
      ]
    );
  };

  const handleViewPhoto = (filename: string) => {
    setSelectedPhotoUri(getPhotoUri(filename));
    setPhotoViewerVisible(true);
  };


  const renderPhotoViewer = () => (
    <Modal
      visible={photoViewerVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setPhotoViewerVisible(false)}
    >
      <View style={styles.photoViewerOverlay}>
        <TouchableOpacity
          style={styles.photoViewerCloseArea}
          onPress={() => setPhotoViewerVisible(false)}
        >
          <View style={styles.photoViewerContainer}>
            <TouchableOpacity
              style={styles.photoViewerCloseButton}
              onPress={() => setPhotoViewerVisible(false)}
            >
              <Text style={styles.photoViewerCloseText}>×</Text>
            </TouchableOpacity>
            {selectedPhotoUri && (
              <Image
                source={{ uri: selectedPhotoUri }}
                style={styles.photoViewerImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Type *</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                task.type === 'task' && styles.typeButtonActive
              ]}
              onPress={() => setTask({ ...task, type: 'task' })}
            >
              <Text style={[
                styles.typeButtonText,
                task.type === 'task' && styles.typeButtonTextActive
              ]}>
                Task
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                task.type === 'note' && styles.typeButtonActive
              ]}
              onPress={() => setTask({ ...task, type: 'note' })}
            >
              <Text style={[
                styles.typeButtonText,
                task.type === 'note' && styles.typeButtonTextActive
              ]}>
                Note
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={task.title}
            onChangeText={(text) => setTask({ ...task, title: text })}
            placeholder={task.type === 'note' ? 'Enter note title' : 'Enter task title'}
          />
        </View>

        {task.type === 'task' && (
          <View style={styles.field}>
            <Text style={styles.label}>Crop (Optional)</Text>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={crops.map(crop => ({ label: crop.name, value: crop.id }))}
              maxHeight={300}
              labelField="label"
              valueField="value"
              value={selectedCrop?.id}
              onChange={handleCropSelect}
              renderLeftIcon={() => (
                <Text style={styles.icon}>🌱</Text>
              )}
              renderItem={item => (
                <View style={styles.item}>
                  <Text style={styles.textItem}>{item.label}</Text>
                </View>
              )}
              search
              searchPlaceholder="Search crops..."
              onChangeText={() => {}}
              renderRightIcon={() => (
                <Text style={styles.icon}>▼</Text>
              )}
              dropdownPosition="auto"
              containerStyle={styles.dropdownContainer}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {task.date}
            </Text>
          </TouchableOpacity>
          {renderDatePicker()}
        </View>

        {task.type === 'task' && (
          <View style={styles.field}>
            <View style={styles.switchContainer}>
              <Text style={styles.label}>Enable Succession Planting</Text>
              <Switch
                value={enableSuccession}
                onValueChange={setEnableSuccession}
                trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
              />
            </View>
            
            {enableSuccession && (
              <View style={styles.successionControls}>
                <View style={styles.successionField}>
                  <Text style={styles.sublabel}>Weeks Between Plantings</Text>
                  <TextInput
                    style={[styles.input, styles.numberInput]}
                    value={successionInterval}
                    onChangeText={setSuccessionInterval}
                    keyboardType="number-pad"
                    placeholder="2"
                  />
                </View>
                
                <View style={styles.successionField}>
                  <Text style={styles.sublabel}>Number of Plantings</Text>
                  <TextInput
                    style={[styles.input, styles.numberInput]}
                    value={successionCount}
                    onChangeText={setSuccessionCount}
                    keyboardType="number-pad"
                    placeholder="4"
                  />
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>{task.type === 'note' ? 'Description' : 'Notes'}</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={task.notes}
            onChangeText={(text) => setTask({ ...task, notes: text })}
            placeholder={task.type === 'note' ? 'Describe your garden observation' : 'Add any additional notes'}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.photosHeader}>
            <Text style={styles.label}>Photos</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={handleAddPhoto}
            >
              <Text style={styles.addPhotoText}>+ Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          {task.photos && task.photos.length > 0 ? (
            <View style={styles.photosContainer}>
              {task.photos.map((photo, index) => (
                <View key={photo} style={styles.photoContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPhotoUri(getPhotoUri(photo));
                      setPhotoViewerVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: getPhotoUri(photo) }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deletePhotoButton}
                    onPress={() => handleDeletePhoto(photo)}
                  >
                    <Text style={styles.deletePhotoText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noPhotosContainer}>
              <Text style={styles.noPhotosText}>No photos added yet</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>
            {isNewTask ? (task.type === 'note' ? 'Create Note' : 'Create Task') : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
      {renderPhotoViewer()}
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
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  dropdown: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#666666',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: '#333333',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  icon: {
    marginRight: 5,
    fontSize: 16,
  },
  item: {
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textItem: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  dropdownContainer: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalButton: {
    padding: 8,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  modalButtonTextDone: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  successionControls: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  successionField: {
    marginBottom: 12,
  },
  sublabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 6,
  },
  numberInput: {
    height: 40,
    width: '100%',
  },
  photosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPhotoButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addPhotoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  photosList: {
    maxHeight: 300,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  photoContainer: {
    width: '30%', // Approximately 3 columns with gaps
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePhotoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  noPhotosContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  noPhotosText: {
    color: '#666666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  photoViewerCloseArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerContainer: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  photoViewerCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  photoViewerCloseText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  photoViewerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
}); 