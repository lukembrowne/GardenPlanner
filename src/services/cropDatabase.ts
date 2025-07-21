import * as SQLite from 'expo-sqlite';
import Papa from 'papaparse';

export interface Crop {
  id: string;
  name: string;
  weeksBeforeFrost: number;
  daysToMaturity: number;
}

// Simple UUID generation
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Default crops data
const DEFAULT_CROPS_CSV = `name,weeksBeforeFrost,daysToMaturity
Ageratum,7,80
Amaranth,4,65
Basil,0,55
Beans,0,55
Beets,8,55
Bok Choi,6,55
Broccoli,8,60
Brussels Sprouts,8,90
Cabbage,8,70
Carrots,8,75
Cauliflower,8,60
Celosia,6,90
Cilantro,4,55 
Collards,8,55
Corn,0,70
Cucumbers,4,55
Eggplant,6,65
Ground Cherry,6,75
Kale,8,55
Lavender,8,100
Lettuce,8,45
Melons,4,75
Onions,6,100
Parsley,8,75
Peas,4,60
Peppers,8,65
Potatoes,4,90
Pumpkins,3,90
Radishes,8,30
Spinach,8,40
Sweet Potatoes,0,100
Swiss Chard,8,55
Tomatoes,6,70
Winter Squash,3,90
Zucchini,3,50`;

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

// Initialize the crops table
export const initCropDatabase = async (): Promise<boolean> => {
  console.log('Initializing crop database');
  try {
    const database = await getDb();
    
    // Create crops table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS crops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weeksBeforeFrost INTEGER NOT NULL,
        daysToMaturity INTEGER NOT NULL
      );
    `);

    // Check if crops table is empty
    const result = await database.getAllAsync<Crop>('SELECT * FROM crops;');
    
    if (result.length === 0) {
      // Parse the default crops CSV
      const { data } = Papa.parse<{ name: string; weeksBeforeFrost: string; daysToMaturity: string }>(DEFAULT_CROPS_CSV, {
        header: true,
        skipEmptyLines: true
      });

      // Insert default crops
      for (const crop of data) {
        await database.runAsync(
          `INSERT INTO crops (id, name, weeksBeforeFrost, daysToMaturity)
           VALUES (?, ?, ?, ?)`,
          [
            generateUUID(),
            crop.name,
            parseInt(crop.weeksBeforeFrost),
            parseInt(crop.daysToMaturity)
          ]
        );
      }
    }
    
    console.log('Crop database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing crop database:', error);
    throw error;
  }
};

// Get all crops
export const getCrops = async (): Promise<Crop[]> => {
  try {
    const database = await getDb();
    return await database.getAllAsync<Crop>('SELECT * FROM crops ORDER BY name;');
  } catch (error) {
    console.error('Error getting crops:', error);
    throw error;
  }
};

// Get a crop by its ID
export const getCropById = async (id: string): Promise<Crop | null> => {
  try {
    const database = await getDb();
    const result = await database.getFirstAsync<Crop>(
      'SELECT * FROM crops WHERE id = ?;',
      [id]
    );
    return result || null;
  } catch (error) {
    console.error('Error getting crop by id:', error);
    throw error;
  }
};

// Calculate planting date based on crop and frost date
export const calculatePlantingDate = (
  crop: Crop,
  frostDate: Date
): Date => {
  console.log(`calculatePlantingDate - Input crop: ${JSON.stringify(crop)}`);
  console.log(`calculatePlantingDate - Input frost date: ${frostDate.toISOString()}`);
  
  const plantingDate = new Date(frostDate);
  const daysToSubtract = crop.weeksBeforeFrost * 7;
  console.log(`calculatePlantingDate - Subtracting ${daysToSubtract} days (${crop.weeksBeforeFrost} weeks) from frost date`);
  
  plantingDate.setDate(plantingDate.getDate() - daysToSubtract);
  console.log(`calculatePlantingDate - Calculated planting date: ${plantingDate.toISOString()}`);
  
  return plantingDate;
};

// Create a new crop
export const createCrop = async (crop: Omit<Crop, 'id'>): Promise<Crop> => {
  try {
    const database = await getDb();
    const id = generateUUID();
    
    await database.runAsync(
      `INSERT INTO crops (id, name, weeksBeforeFrost, daysToMaturity)
       VALUES (?, ?, ?, ?)`,
      [id, crop.name, crop.weeksBeforeFrost, crop.daysToMaturity]
    );
    
    return {
      id,
      ...crop
    };
  } catch (error) {
    console.error('Error creating crop:', error);
    throw error;
  }
};

// Update an existing crop
export const updateCrop = async (id: string, updates: Partial<Crop>): Promise<Crop> => {
  try {
    const database = await getDb();
    
    const updatesList = Object.entries(updates)
      .filter(([_, value]) => value !== undefined)
      .map(([key]) => `${key} = ?`);
    
    const values = Object.entries(updates)
      .filter(([_, value]) => value !== undefined)
      .map(([_, value]) => value);
    
    await database.runAsync(
      `UPDATE crops SET ${updatesList.join(', ')} WHERE id = ?;`,
      [...values, id]
    );
    
    return getCropById(id) as Promise<Crop>;
  } catch (error) {
    console.error('Error updating crop:', error);
    throw error;
  }
};

// Delete a crop by its ID
export const deleteCrop = async (id: string): Promise<void> => {
  try {
    const database = await getDb();
    await database.runAsync('DELETE FROM crops WHERE id = ?;', [id]);
  } catch (error) {
    console.error('Error deleting crop:', error);
    throw error;
  }
}; 