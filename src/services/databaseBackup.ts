import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Share } from 'react-native';
import { initDatabase } from './database';
import { getCrops } from './cropDatabase';
import { getSettings } from './settings';
import { getTasks } from './database';

// Add a function to reset database connections
const resetDatabaseConnections = async () => {
  try {
    // Reinitialize the database
    await initDatabase();
  } catch (error) {
    console.error('Error resetting database connections:', error);
    throw error;
  }
};

interface DatabaseBackup {
  version: string;
  timestamp: string;
  data: {
    tasks: any[];
    crops: any[];
    settings: any[];
  };
}

export const exportDatabase = async (): Promise<string> => {
  try {
    console.log('Starting database export process...');
    
    // Get all data from each table
    const currentYear = new Date().getFullYear();
    const tasks = await getTasks(currentYear);
    const crops = await getCrops();
    const settings = await getSettings();

    // Create backup object
    const backup: DatabaseBackup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        tasks,
        crops,
        settings: [settings] // Convert single settings object to array for consistency
      }
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(backup, null, 2);

    // Create temporary file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempFilePath = `${FileSystem.cacheDirectory}gardenplanner_backup_${timestamp}.json`;
    
    // Write JSON to file
    await FileSystem.writeAsStringAsync(tempFilePath, jsonString);

    // Share the backup file
    console.log('Sharing backup file...');
    await Share.share({
      url: tempFilePath,
      title: `GardenPlanner_Backup_${timestamp}`,
    });

    // Clean up temporary file
    await FileSystem.deleteAsync(tempFilePath);

    console.log('Export completed successfully');
    return tempFilePath;
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
};

export const importDatabase = async (backupPath: string): Promise<void> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    console.log('Starting database import process...');
    console.log('Backup file path:', backupPath);

    // Check if backup file exists
    const fileInfo = await FileSystem.getInfoAsync(backupPath);
    if (!fileInfo.exists) {
      throw new Error('Backup file not found at: ' + backupPath);
    }

    // Read and parse JSON backup file
    const jsonString = await FileSystem.readAsStringAsync(backupPath);
    const backup: DatabaseBackup = JSON.parse(jsonString);

    // Validate backup structure
    if (!backup.version || !backup.timestamp || !backup.data) {
      throw new Error('Invalid backup file format');
    }

    // Initialize new database
    console.log('Initializing new database...');
    await initDatabase();

    // Get database connection
    db = await SQLite.openDatabaseAsync('gardenplanner.db');

    // Start transaction
    await db.execAsync('BEGIN TRANSACTION');

    try {
      // Clear existing data from all tables
      console.log('Clearing existing data...');
      await db.execAsync('DELETE FROM tasks;');
      await db.execAsync('DELETE FROM crops;');
      await db.execAsync('DELETE FROM settings;');

      // Import crops first (since tasks reference them)
      console.log('Importing crops...');
      for (const crop of backup.data.crops) {
        await db.runAsync(
          `INSERT INTO crops (id, name, weeksBeforeFrost, daysToMaturity)
           VALUES (?, ?, ?, ?)`,
          [crop.id, crop.name, crop.weeksBeforeFrost, crop.daysToMaturity]
        );
      }

      // Import tasks
      console.log('Importing tasks...');
      for (const task of backup.data.tasks) {
        await db.runAsync(
          `INSERT INTO tasks (id, title, cropId, date, notes, completed, year)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            task.id,
            task.title,
            task.cropId,
            task.date,
            task.notes,
            task.completed ? 1 : 0,
            task.year
          ]
        );
      }

      // Import settings
      console.log('Importing settings...');
      if (backup.data.settings && backup.data.settings.length > 0) {
        const settings = backup.data.settings[0];
        await db.runAsync(
          `INSERT INTO settings (frost_start_date, frost_end_date, current_year, notifications_enabled)
           VALUES (?, ?, ?, ?)`,
          [
            settings.frostStartDate,
            settings.frostEndDate,
            settings.currentYear,
            settings.notificationsEnabled ? 1 : 0
          ]
        );
      }

      // Commit transaction
      await db.execAsync('COMMIT');
      console.log('Database import completed successfully');

      // Reset connections after successful import
      await resetDatabaseConnections();
    } catch (error) {
      // Rollback transaction on error
      if (db) {
        await db.execAsync('ROLLBACK');
      }
      throw error;
    } finally {
      // Close database connection
      if (db) {
        await db.closeAsync();
      }
    }
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
};
