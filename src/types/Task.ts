export type TaskType = 'seeding' | 'transplanting' | 'harvesting' | 'maintenance';
export type ItemType = 'task' | 'note';

export interface Task {
  id: string;
  title: string;
  type: ItemType;
  cropId?: string;
  date: string;
  notes?: string;
  photos?: string[];
  completed: boolean;
  year: number;
  isTemplate?: boolean;
  category?: TaskCategory;
  archived?: boolean;
}

export type TaskCategory = 'seeding' | 'maintenance' | 'harvesting' | 'planning' | 'other';

export interface CreateTaskInput {
  id?: string;
  title: string;
  type: ItemType;
  cropId?: string;
  date: string;
  notes?: string;
  photos?: string[];
  completed?: boolean;
  year?: number;
  isTemplate?: boolean;
  category?: TaskCategory;
  archived?: boolean;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  completed?: boolean;
} 