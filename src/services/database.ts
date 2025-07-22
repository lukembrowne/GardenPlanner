import * as SQLite from 'expo-sqlite';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types/Task';

// Database row type - photos are stored as JSON string
interface TaskRow {
  id: string;
  title: string;
  cropId?: string;
  date: string;
  notes?: string;
  photos?: string; // JSON string in database
  completed: number; // SQLite boolean as number
  year: number;
}
import { initSettingsTable } from './settings';
import { cleanupTaskPhotos } from './photoManager';

// Simple UUID generation
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Database name
const DB_NAME = 'gardenplanner.db';

// Get the database connection
let db: SQLite.SQLiteDatabase | null = null;
const getDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
};

// Initialize the database by creating any required tables
export const initDatabase = async (): Promise<boolean> => {
  console.log('Initializing database');
  try {
    const database = await getDb();
    
   // Create tables using execAsync for bulk operations
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cropId TEXT,
        date TEXT NOT NULL,
        notes TEXT,
        photos TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        year INTEGER NOT NULL,
        FOREIGN KEY (cropId) REFERENCES crops(id)
      );
    `);

    // Add photos column to existing tasks table if it doesn't exist
    try {
      await database.execAsync(`ALTER TABLE tasks ADD COLUMN photos TEXT;`);
    } catch (error) {
      // Column already exists or other error - this is expected for existing tables
    }

    //  // Create tables using execAsync for bulk operations
    //  await database.execAsync(`
    //   PRAGMA journal_mode = WAL;
    //   DROP TABLE IF EXISTS tasks;
    //   CREATE TABLE tasks (
    //     id TEXT PRIMARY KEY,
    //     title TEXT NOT NULL,
    //     cropId TEXT,
    //     date TEXT NOT NULL,
    //     notes TEXT,
    //     completed INTEGER NOT NULL DEFAULT 0,
    //     year INTEGER NOT NULL,
    //     FOREIGN KEY (cropId) REFERENCES crops(id)
    //   );
    // `);
    
    // Initialize settings table
    await initSettingsTable();
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Create a new task
export const createTask = async (task: CreateTaskInput): Promise<Task> => {
  try {
    const database = await getDb();
    
    // Generate a new ID if not provided
    const taskId = task.id || generateUUID();
    
    // Ensure year is provided, default to current year if not specified
    const year = task.year || new Date().getFullYear();

    console.log('Creating task:', task);
    
    // Use runAsync for write operations
    const result = await database.runAsync(
      `INSERT INTO tasks (id, title, cropId, date, notes, photos, completed, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        task.title,
        task.cropId || null,
        task.date,
        task.notes || null,
        task.photos ? JSON.stringify(task.photos) : null,
        task.completed ? 1 : 0,
        year
      ]
    );
    
    console.log('Task created:', result.lastInsertRowId);
    return {
      id: taskId,
      title: task.title,
      cropId: task.cropId,
      date: task.date,
      notes: task.notes,
      photos: task.photos,
      completed: Boolean(task.completed),
      year: task.year || new Date().getFullYear()
    };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// Get all tasks for a specific year
export const getTasks = async (year: number): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    // Use getAllAsync to get all results as an array
    const tasks = await database.getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE year = ? ORDER BY date;',
      [year]
    );
    
    return tasks.map(task => ({
      ...task,
      completed: Boolean(task.completed),
      photos: task.photos ? JSON.parse(task.photos) as string[] : []
    }));
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

// Get all tasks for a specific crop
export const getTasksByCropId = async (cropId: string): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    const tasks = await database.getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE cropId = ? ORDER BY date;',
      [cropId]
    );
    
    return tasks.map(task => ({
      ...task,
      completed: Boolean(task.completed),
      photos: task.photos ? JSON.parse(task.photos) as string[] : []
    }));
  } catch (error) {
    console.error('Error getting tasks by crop:', error);
    throw error;
  }
};

// Update an existing task
export const updateTask = async (id: string, updates: UpdateTaskInput): Promise<Task> => {
  try {
    const processedUpdates = Object.entries(updates)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (key === 'photos' && Array.isArray(value)) {
          return [key, JSON.stringify(value)];
        }
        return [key, value];
      });
    
    const updatesList = processedUpdates.map(([key]) => `${key} = ?`);
    const values = processedUpdates.map(([_, value]) => value);
    
    const database = await getDb();
    
    // Use runAsync for write operations
    await database.runAsync(
      `UPDATE tasks SET ${updatesList.join(', ')} WHERE id = ?;`,
      [...values, id]
    );
    
    // Get the updated task
    return getTaskById(id);
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Get a task by its ID
export const getTaskById = async (id: string): Promise<Task> => {
  try {
    const database = await getDb();
    
    // Use getFirstAsync to get a single row
    const task = await database.getFirstAsync<TaskRow>(
      'SELECT * FROM tasks WHERE id = ?;',
      [id]
    );
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    return {
      ...task,
      completed: Boolean(task.completed),
      photos: task.photos ? JSON.parse(task.photos) as string[] : []
    };
  } catch (error) {
    console.error('Error getting task by id:', error);
    throw error;
  }
};

// Delete a task by its ID
export const deleteTask = async (id: string): Promise<void> => {
  try {
    const database = await getDb();
    
    // Get the task to clean up its photos
    const task = await getTaskById(id);
    if (task.photos && task.photos.length > 0) {
      await cleanupTaskPhotos(task.photos);
    }
    
    // Use runAsync for write operations
    await database.runAsync(
      'DELETE FROM tasks WHERE id = ?;',
      [id]
    );
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}; 