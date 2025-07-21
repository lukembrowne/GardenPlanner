import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SectionList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task } from '../types/Task';
import { TaskItem } from '../components/TaskItem';
import { initDatabase, getTasks, updateTask, deleteTask } from '../services/database';
import { getSettings } from '../services/settings';
import { Swipeable } from 'react-native-gesture-handler';

type RootStackParamList = {
  MainScreen: undefined;
  TaskDetails: { taskId: string };
  Settings: undefined;
};

type MainScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainScreen'>;

export const MainScreen: React.FC = () => {
  const navigation = useNavigation<MainScreenNavigationProp>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const loadTasks = async () => {
    try {
      const loadedTasks = await getTasks(currentYear);
      setTasks(loadedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      setCurrentYear(settings.currentYear);
      await loadTasks();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Load tasks and settings when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const setupScreen = async () => {
        try {
          await loadSettings();
        } catch (error) {
          console.error('Error setting up screen:', error);
        }
      };
      setupScreen();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  };

  const handleTaskPress = (task: Task) => {
    navigation.navigate('TaskDetails', { taskId: task.id });
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      await loadTasks();
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const renderRightActions = (task: Task) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            'Delete Task',
            'Are you sure you want to delete this task?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTask(task.id) }
            ]
          );
        }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const parseDate = (dateString: string): Date | null => {
    try {
      // Handle MM/DD/YYYY format
      const [month, day, year] = dateString.split('/').map(Number);
      if (isNaN(month) || isNaN(day) || isNaN(year)) {
        return null;
      }
      // Note: month is 0-based in JavaScript Date constructor
      return new Date(year, month - 1, day);
    } catch (error) {
      console.warn(`Error parsing date: ${dateString}`, error);
      return null;
    }
  };

  const groupTasksByWeek = (tasks: Task[]) => {
    const groupedTasks = tasks.reduce((acc: { [key: string]: Task[] }, task) => {
      try {
        const date = parseDate(task.date);
        if (!date || isNaN(date.getTime())) {
          console.warn(`Invalid date for task ${task.id}: ${task.date}`);
          return acc;
        }
        
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!acc[weekKey]) {
          acc[weekKey] = [];
        }
        acc[weekKey].push(task);
      } catch (error) {
        console.warn(`Error processing date for task ${task.id}: ${task.date}`, error);
      }
      return acc;
    }, {});

    return Object.entries(groupedTasks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasks]) => {
        try {
          const weekDate = new Date(date);
          if (isNaN(weekDate.getTime())) {
            console.warn(`Invalid week date: ${date}`);
            return null;
          }
          return {
            title: weekDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            }),
            data: tasks.sort((a, b) => {
              const dateA = parseDate(a.date);
              const dateB = parseDate(b.date);
              if (!dateA || !dateB) return 0;
              return dateA.getTime() - dateB.getTime();
            })
          };
        } catch (error) {
          console.warn(`Error formatting week date: ${date}`, error);
          return null;
        }
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);
  };

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Task }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <TaskItem
        task={item}
        onPress={handleTaskPress}
        onToggleComplete={handleToggleComplete}
      />
    </Swipeable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No tasks for this year</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('TaskDetails', { taskId: 'new' })}
      >
        <Text style={styles.addButtonText}>Add New Task</Text>
      </TouchableOpacity>
    </View>
  );

  const sections = groupTasksByWeek(tasks);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Garden Tasks</Text>
        <Text style={styles.year}>{currentYear}</Text>
      </View>
      
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.headerCell}>
          <Text style={styles.headerText}>Date</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.headerText}>Task</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TaskDetails', { taskId: 'new' })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#4CAF50',
    borderBottomWidth: 1,
    borderBottomColor: '#388E3C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  year: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerCell: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    marginLeft: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionHeader: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
}); 