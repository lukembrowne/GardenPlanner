import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task, TaskType } from '../types/Task';
import { format, parse } from 'date-fns';

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

const getTaskTypeColor = (type: TaskType): string => {
  switch (type) {
    case 'seeding':
      return '#4CAF50';
    case 'transplanting':
      return '#FF9800';
    case 'harvesting':
      return '#2196F3';
    case 'maintenance':
      return '#9E9E9E';
    default:
      return '#9E9E9E';
  }
};

export const TaskItem: React.FC<TaskItemProps> = ({ task, onPress, onToggleComplete }) => {
  const parsedDate = parse(task.date, 'MM/dd/yyyy', new Date());
  const formattedDate = format(parsedDate, 'MM/dd');

  return (
    <View style={[styles.container, task.completed && styles.completedContainer]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.leftSection]}
          onPress={() => onToggleComplete(task)}
        >
          <View style={[styles.checkbox, task.completed && styles.checked]}>
            {task.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateContainer}
          onPress={() => onToggleComplete(task)}
        >
          <Text style={[styles.date, task.completed && styles.completedText]}>
            {formattedDate}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vegetableContainer}
          onPress={() => onPress(task)}
        >
          <Text style={[styles.vegetable, task.completed && styles.completedText]}>
            {task.title}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  completedContainer: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftSection: {
    padding: 8,
    margin: -8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  checked: {
    backgroundColor: '#4CAF50',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  vegetableContainer: {
    flex: 3,
  },
  vegetable: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  completedText: {
    color: '#9E9E9E',
    textDecorationLine: 'line-through',
  },
  dateContainer: {
    flex: 1,
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#666666',
  },
}); 