import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { PhotoLibraryOptions, PhotoSaveResult } from '../types/PhotoLibrary';

const PHOTOS_DIR = FileSystem.documentDirectory + 'task_photos/';

export const initPhotoDirectory = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error initializing photo directory:', error);
    throw error;
  }
};

export const saveToPhotoLibrary = async (uri: string): Promise<boolean> => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.warn('Photo library permission denied');
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (error) {
    console.error('Error saving to photo library:', error);
    return false;
  }
};

export const savePhotoToStorage = async (uri: string, taskId: string, options?: PhotoLibraryOptions): Promise<PhotoSaveResult> => {
  try {
    await initPhotoDirectory();
    
    const timestamp = Date.now();
    const filename = `${taskId}_${timestamp}.jpg`;
    const destination = PHOTOS_DIR + filename;
    
    await FileSystem.copyAsync({
      from: uri,
      to: destination
    });
    
    const result: PhotoSaveResult = {
      uri: filename,
      savedToLibrary: false
    };
    
    // Also save to photo library if requested
    if (options?.saveToLibrary) {
      try {
        const librarySuccess = await saveToPhotoLibrary(uri);
        result.savedToLibrary = librarySuccess;
      } catch (error) {
        result.libraryError = error instanceof Error ? error.message : 'Failed to save to photo library';
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error saving photo:', error);
    throw error;
  }
};

export const getPhotoUri = (filename: string): string => {
  return PHOTOS_DIR + filename;
};

export const deletePhoto = async (filename: string): Promise<void> => {
  try {
    const photoPath = PHOTOS_DIR + filename;
    const fileInfo = await FileSystem.getInfoAsync(photoPath);
    
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(photoPath);
    }
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
};

export const cleanupTaskPhotos = async (photos: string[]): Promise<void> => {
  try {
    const deletePromises = photos.map(photo => deletePhoto(photo));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error cleaning up task photos:', error);
    throw error;
  }
};

export const launchImagePicker = async (options?: PhotoLibraryOptions): Promise<PhotoSaveResult | null> => {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      throw new Error('Permission to access photo library denied');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      return {
        uri,
        savedToLibrary: false
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error launching image picker:', error);
    throw error;
  }
};

export const launchCamera = async (options?: PhotoLibraryOptions): Promise<PhotoSaveResult | null> => {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      throw new Error('Permission to access camera denied');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const photoResult: PhotoSaveResult = {
        uri,
        savedToLibrary: false
      };
      
      // Also save to photo library if requested
      if (options?.saveToLibrary) {
        try {
          const librarySuccess = await saveToPhotoLibrary(uri);
          photoResult.savedToLibrary = librarySuccess;
        } catch (error) {
          photoResult.libraryError = error instanceof Error ? error.message : 'Failed to save to photo library';
        }
      }
      
      return photoResult;
    }
    
    return null;
  } catch (error) {
    console.error('Error launching camera:', error);
    throw error;
  }
};