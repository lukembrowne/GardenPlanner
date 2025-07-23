import * as SQLite from 'expo-sqlite';
import { Task, CreateTaskInput, UpdateTaskInput, ItemType } from '../types/Task';

// Database row type - photos are stored as JSON string
interface TaskRow {
  id: string;
  title: string;
  type: string;
  cropId?: string | null;
  date: string;
  notes?: string | null;
  photos?: string | null; // JSON string in database
  completed: number; // SQLite boolean as number
  year: number;
  isTemplate?: number | null; // SQLite boolean as number
  category?: string | null;
  archived?: number | null; // SQLite boolean as number
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

// Check if a column exists in a table
const columnExists = async (database: SQLite.SQLiteDatabase, tableName: string, columnName: string): Promise<boolean> => {
  try {
    const result = await database.getAllAsync<{name: string}>(
      `PRAGMA table_info(${tableName})`
    );
    return result.some(column => column.name === columnName);
  } catch (error) {
    console.error('Error checking column existence:', error);
    return false;
  }
};

// Build query with conditional archived filter
const buildTaskQuery = async (database: SQLite.SQLiteDatabase, baseQuery: string): Promise<string> => {
  const hasArchived = await columnExists(database, 'tasks', 'archived');
  if (hasArchived) {
    // Add archived filter if column exists
    if (baseQuery.includes('WHERE')) {
      return baseQuery.replace('WHERE', 'WHERE (archived = 0 OR archived IS NULL) AND');
    } else {
      return baseQuery.replace('ORDER BY', 'WHERE (archived = 0 OR archived IS NULL) ORDER BY');
    }
  }
  return baseQuery;
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
        type TEXT NOT NULL DEFAULT 'task',
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

    // Add type column to existing tasks table if it doesn't exist
    try {
      await database.execAsync(`ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'task';`);
    } catch (error) {
      // Column already exists or other error - this is expected for existing tables
    }

    // Add template columns to existing tasks table if they don't exist
    try {
      await database.execAsync(`ALTER TABLE tasks ADD COLUMN isTemplate INTEGER NOT NULL DEFAULT 0;`);
    } catch (error) {
      // Column already exists or other error - this is expected for existing tables
    }

    try {
      await database.execAsync(`ALTER TABLE tasks ADD COLUMN category TEXT;`);
    } catch (error) {
      // Column already exists or other error - this is expected for existing tables
    }

    try {
      await database.execAsync(`ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;`);
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
    
    // Check which columns exist
    const hasTemplate = await columnExists(database, 'tasks', 'isTemplate');
    const hasCategory = await columnExists(database, 'tasks', 'category');
    const hasArchived = await columnExists(database, 'tasks', 'archived');
    
    // Build dynamic query based on available columns
    let columns = 'id, title, type, cropId, date, notes, photos, completed, year';
    let placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?';
    let values: any[] = [
      taskId,
      task.title,
      task.type,
      task.cropId || null,
      task.date,
      task.notes || null,
      task.photos ? JSON.stringify(task.photos) : null,
      task.completed ? 1 : 0,
      year
    ];
    
    if (hasTemplate) {
      columns += ', isTemplate';
      placeholders += ', ?';
      values.push(task.isTemplate ? 1 : 0);
    }
    
    if (hasCategory) {
      columns += ', category';
      placeholders += ', ?';
      values.push(task.category || null);
    }
    
    if (hasArchived) {
      columns += ', archived';
      placeholders += ', ?';
      values.push(task.archived ? 1 : 0);
    }
    
    // Use runAsync for write operations
    const result = await database.runAsync(
      `INSERT INTO tasks (${columns}) VALUES (${placeholders})`,
      values
    );
    
    console.log('Task created:', result.lastInsertRowId);
    return {
      id: taskId,
      title: task.title,
      type: task.type,
      cropId: task.cropId,
      date: task.date,
      notes: task.notes,
      photos: task.photos,
      completed: Boolean(task.completed),
      year: task.year || new Date().getFullYear(),
      isTemplate: task.isTemplate,
      category: task.category,
      archived: task.archived
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
    
    // Build query with conditional archived filter
    const baseQuery = 'SELECT * FROM tasks WHERE year = ? ORDER BY date;';
    const query = await buildTaskQuery(database, baseQuery);
    
    // Use getAllAsync to get all results as an array
    const tasks = await database.getAllAsync<TaskRow>(query, [year]);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
    }));
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

// Get tasks by type for a specific year
export const getTasksByType = async (year: number, type: ItemType): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    // Build query with conditional archived filter
    const baseQuery = 'SELECT * FROM tasks WHERE year = ? AND type = ? ORDER BY date;';
    const query = await buildTaskQuery(database, baseQuery);
    
    const tasks = await database.getAllAsync<TaskRow>(query, [year, type]);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
    }));
  } catch (error) {
    console.error('Error getting tasks by type:', error);
    throw error;
  }
};

// Get all tasks for a specific crop
export const getTasksByCropId = async (cropId: string): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    // Build query with conditional archived filter
    const baseQuery = 'SELECT * FROM tasks WHERE cropId = ? ORDER BY date;';
    const query = await buildTaskQuery(database, baseQuery);
    
    const tasks = await database.getAllAsync<TaskRow>(query, [cropId]);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
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
        if (key === 'completed' || key === 'isTemplate' || key === 'archived') {
          return [key, value ? 1 : 0];
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
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
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

// Get templates by category
export const getTemplatesByCategory = async (category?: string): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    let query = 'SELECT * FROM tasks WHERE isTemplate = 1';
    const params: any[] = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, title';
    
    const tasks = await database.getAllAsync<TaskRow>(query, params);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
    }));
  } catch (error) {
    console.error('Error getting templates by category:', error);
    throw error;
  }
};

// Get all available years that have tasks
export const getAvailableYears = async (): Promise<number[]> => {
  try {
    const database = await getDb();
    
    const years = await database.getAllAsync<{ year: number }>(
      'SELECT DISTINCT year FROM tasks ORDER BY year DESC'
    );
    
    return years.map(row => row.year);
  } catch (error) {
    console.error('Error getting available years:', error);
    throw error;
  }
};

// Copy selected tasks from one year to another with selective criteria
export interface CopyYearOptions {
  fromYear: number;
  toYear: number;
  categories?: string[];
  includeTemplates?: boolean;
  includeNotes?: boolean;
  resetCompletion?: boolean;
}

export const copySelectedTasks = async (options: CopyYearOptions): Promise<number> => {
  try {
    const database = await getDb();
    
    // Build query conditions
    const conditions: string[] = ['year = ?'];
    const params: any[] = [options.fromYear];
    
    if (options.categories && options.categories.length > 0) {
      const placeholders = options.categories.map(() => '?').join(',');
      conditions.push(`category IN (${placeholders})`);
      params.push(...options.categories);
    }
    
    if (options.includeTemplates === false) {
      conditions.push('isTemplate = 0');
    }
    
    if (options.includeNotes === false) {
      conditions.push('type = "task"');
    }
    
    const query = `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY date`;
    
    const sourceTasks = await database.getAllAsync<TaskRow>(query, params);
    
    // Copy each task with adjusted date and new ID
    let copiedCount = 0;
    
    for (const task of sourceTasks) {
      const newId = generateUUID();
      const yearDiff = options.toYear - options.fromYear;
      
      // Adjust the date by the year difference
      let newDate = task.date;
      try {
        const originalDate = new Date(task.date);
        if (!isNaN(originalDate.getTime())) {
          const adjustedDate = new Date(originalDate);
          adjustedDate.setFullYear(originalDate.getFullYear() + yearDiff);
          newDate = adjustedDate.toISOString().split('T')[0];
        }
      } catch (error) {
        // If date parsing fails, keep original date format but adjust manually
        const dateMatch = task.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const newYear = parseInt(dateMatch[1]) + yearDiff;
          newDate = task.date.replace(/^\d{4}/, newYear.toString());
        }
      }
      
      await database.runAsync(
        `INSERT INTO tasks (id, title, type, cropId, date, notes, photos, completed, year, isTemplate, category, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          task.title,
          task.type,
          task.cropId || null,
          newDate,
          task.notes || null,
          null, // Don't copy photos, start fresh
          options.resetCompletion === false ? task.completed : 0,
          options.toYear,
          task.isTemplate || 0,
          task.category || null,
          0 // Don't copy archived status
        ]
      );
      
      copiedCount++;
    }
    
    console.log(`Successfully copied ${copiedCount} tasks from ${options.fromYear} to ${options.toYear}`);
    return copiedCount;
  } catch (error) {
    console.error('Error copying selected tasks:', error);
    throw error;
  }
};

// Archive notes from previous years
export const archiveNotesFromYear = async (year: number): Promise<number> => {
  try {
    const database = await getDb();
    
    const result = await database.runAsync(
      'UPDATE tasks SET archived = 1 WHERE year = ? AND type = "note" AND archived = 0',
      [year]
    );
    
    console.log(`Archived ${result.changes} notes from year ${year}`);
    return result.changes || 0;
  } catch (error) {
    console.error('Error archiving notes:', error);
    throw error;
  }
};

// Get archived notes for a specific year
export const getArchivedNotes = async (year: number): Promise<Task[]> => {
  try {
    const database = await getDb();
    
    const tasks = await database.getAllAsync<TaskRow>(
      'SELECT * FROM tasks WHERE year = ? AND type = "note" AND archived = 1 ORDER BY date',
      [year]
    );
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      type: (task.type || 'task') as ItemType,
      cropId: task.cropId || undefined,
      date: task.date,
      notes: task.notes || undefined,
      photos: task.photos ? JSON.parse(task.photos) as string[] : [],
      completed: Boolean(task.completed),
      year: task.year,
      isTemplate: Boolean(task.isTemplate || 0),
      category: task.category as any,
      archived: Boolean(task.archived || 0)
    }));
  } catch (error) {
    console.error('Error getting archived notes:', error);
    throw error;
  }
};

// Unarchive notes
export const unarchiveNote = async (id: string): Promise<void> => {
  try {
    const database = await getDb();
    
    await database.runAsync(
      'UPDATE tasks SET archived = 0 WHERE id = ?',
      [id]
    );
    
    console.log(`Unarchived note ${id}`);
  } catch (error) {
    console.error('Error unarchiving note:', error);
    throw error;
  }
}; 