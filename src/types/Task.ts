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
}

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
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  completed?: boolean;
} 