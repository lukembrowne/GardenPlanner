import * as SQLite from 'expo-sqlite';

const DB_NAME = 'gardenplanner.db';

interface GardenSettings {
  frostStartDate: string;
  frostEndDate: string;
  currentYear: number;
  notificationsEnabled: boolean;
  saveToPhotoLibrary: boolean;
}

// Get the database connection
let db: SQLite.SQLiteDatabase | null = null;
const getDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
};

export const initSettingsTable = async (): Promise<void> => {
  try {
    const database = await getDb();
    
    // Create settings table using execAsync for bulk operations
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        frost_start_date TEXT NOT NULL,
        frost_end_date TEXT NOT NULL,
        current_year INTEGER NOT NULL,
        notifications_enabled INTEGER NOT NULL DEFAULT 1,
        save_to_photo_library INTEGER NOT NULL DEFAULT 0
      );
    `);
    
    // Check if save_to_photo_library column exists and add it if not
    try {
      const tableInfo = await database.getAllAsync("PRAGMA table_info(settings);");
      const hasPhotoLibraryColumn = tableInfo.some((column: any) => column.name === 'save_to_photo_library');
      
      if (!hasPhotoLibraryColumn) {
        console.log('Adding save_to_photo_library column to settings table');
        await database.execAsync(`
          ALTER TABLE settings ADD COLUMN save_to_photo_library INTEGER NOT NULL DEFAULT 0;
        `);
        console.log('save_to_photo_library column added successfully');
      }
    } catch (migrationError) {
      console.log('Migration check/execution completed:', migrationError);
    }
    
    console.log('Settings table initialized successfully');
  } catch (error) {
    console.error('Error initializing settings table:', error);
    throw error;
  }
};

export const getSettings = async (): Promise<GardenSettings> => {
  try {
    const database = await getDb();
    
    // Use getFirstAsync to get the most recent settings
    const settings = await database.getFirstAsync<{
      frost_start_date: string;
      frost_end_date: string;
      current_year: number;
      notifications_enabled: number;
      save_to_photo_library?: number; // Optional in case column doesn't exist yet
    }>('SELECT * FROM settings ORDER BY id DESC LIMIT 1;');
    
    if (settings) {
      return {
        frostStartDate: settings.frost_start_date,
        frostEndDate: settings.frost_end_date,
        currentYear: settings.current_year,
        notificationsEnabled: Boolean(settings.notifications_enabled),
        saveToPhotoLibrary: Boolean(settings.save_to_photo_library || 0),
      };
    }
    
    // Default settings if none exist
    const defaultSettings: GardenSettings = {
      frostStartDate: '10-03', // October 3rd
      frostEndDate: '05-11',   // May 11th
      currentYear: new Date().getFullYear(),
      notificationsEnabled: true,
      saveToPhotoLibrary: false,
    };
    
    // Save default settings
    await saveSettings(defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

export const saveSettings = async (settings: GardenSettings): Promise<void> => {
  try {
    const database = await getDb();
    
    // Use runAsync for write operations
    await database.runAsync(
      `INSERT INTO settings (frost_start_date, frost_end_date, current_year, notifications_enabled, save_to_photo_library)
       VALUES (?, ?, ?, ?, ?);`,
      [settings.frostStartDate, settings.frostEndDate, settings.currentYear, settings.notificationsEnabled ? 1 : 0, settings.saveToPhotoLibrary ? 1 : 0]
    );
    
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

export const copyYearSchedule = async (fromYear: number, toYear: number): Promise<void> => {
  try {
    const database = await getDb();
    
    // First, get all tasks from the source year using correct column names
    const sourceTasks = await database.getAllAsync<{
      title: string;
      date: string;
      type: string;
      notes: string | null;
      completed: number;
      cropId: string | null;
    }>('SELECT title, date, type, notes, completed, cropId FROM tasks WHERE year = ?;', [fromYear]);
    
    // Then insert each task with a new ID and the target year, adjusting dates
    for (const task of sourceTasks) {
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Adjust the date by the year difference
      let newDate = task.date;
      try {
        const originalDate = new Date(task.date);
        if (!isNaN(originalDate.getTime())) {
          const adjustedDate = new Date(originalDate);
          adjustedDate.setFullYear(toYear);
          newDate = adjustedDate.toISOString().split('T')[0];
        }
      } catch (error) {
        // If date parsing fails, keep original date format but adjust manually
        const dateMatch = task.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          newDate = task.date.replace(/^\d{4}/, toYear.toString());
        }
      }
      
      await database.runAsync(
        `INSERT INTO tasks (id, title, date, type, notes, completed, year, cropId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [newId, task.title, newDate, task.type, task.notes, task.completed, toYear, task.cropId]
      );
    }
    
    console.log(`Successfully copied ${sourceTasks.length} tasks from ${fromYear} to ${toYear}`);
  } catch (error) {
    console.error('Error copying year schedule:', error);
    throw error;
  }
}; 