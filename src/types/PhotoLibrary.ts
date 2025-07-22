export interface PhotoLibraryOptions {
  saveToLibrary: boolean;
}

export interface PhotoSaveResult {
  uri: string;
  savedToLibrary?: boolean;
  libraryError?: string;
}

export interface PhotoLibrarySettings {
  saveToPhotoLibrary: boolean;
}