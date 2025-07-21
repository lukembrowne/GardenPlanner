import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getTasks } from './database';
import { getSettings } from './settings';
import { format, addDays, startOfWeek, isWithinInterval } from 'date-fns';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registerForPushNotifications = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get notification permissions!');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const scheduleWeeklyNotification = async () => {
  try {
    // Cancel any existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Get current settings and tasks
    const settings = await getSettings();
    
    if (!settings.notificationsEnabled) {
      console.log('Notifications are disabled in settings');
      return;
    }

    const tasks = await getTasks(settings.currentYear);

    // Get next Sunday at 9 AM
    const now = new Date();
    const nextSunday = startOfWeek(now, { weekStartsOn: 0 });
    if (nextSunday <= now) {
      nextSunday.setDate(nextSunday.getDate() + 7);
    }
    nextSunday.setHours(9, 0, 0, 0);

    // Get tasks for the upcoming week
    const weekStart = nextSunday;
    const weekEnd = addDays(weekStart, 7);
    
    const upcomingTasks = tasks.filter(task => {
      const taskDate = new Date(task.date);
      return isWithinInterval(taskDate, { start: weekStart, end: weekEnd });
    });

    if (upcomingTasks.length === 0) {
      console.log('No tasks for next week, skipping notification');
      return;
    }

    // Create notification content
    const taskList = upcomingTasks
      .map(task => `• ${task.title} (${format(new Date(task.date), 'MM/dd/YYYY')})`)
      .join('\n');

    const notificationContent = {
      title: 'Weekly Garden Tasks',
      body: `Here are your tasks for this week:\n\n${taskList}`,
      data: { type: 'weekly_tasks' },
    };

    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        type: 'timeInterval',
        seconds: 1, // For testing, will be replaced with weekly schedule
      },
    });

    // Schedule the weekly notification
    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: nextSunday,
        repeats: true,
        seconds: 7 * 24 * 60 * 60, // 7 days in seconds
      },
    });

    console.log('Weekly notification scheduled for:', nextSunday);
  } catch (error) {
    console.error('Error scheduling weekly notification:', error);
  }
};

export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
};

export const scheduleTestNotification = async () => {
  try {
    // Get current tasks
    const settings = await getSettings();
    const tasks = await getTasks(settings.currentYear);

    // Randomly select 3-4 tasks
    const shuffledTasks = [...tasks].sort(() => Math.random() - 0.5);
    const selectedTasks = shuffledTasks.slice(0, Math.floor(Math.random() * 2) + 3);

    // Create notification content
    const taskList = selectedTasks
      .map(task => {
        const date = new Date(task.date);
        return `• ${task.title} (${format(date, 'MM/dd/YYYY')})`;
      })
      .join('\n');

    const notificationContent = {
      title: 'Test: Weekly Garden Tasks',
      body: `Here are your test tasks:\n\n${taskList}`,
      data: { type: 'test_tasks' },
    };

    // Schedule notification for 5 seconds from now
    const fiveSecondsFromNow = new Date();
    fiveSecondsFromNow.setSeconds(fiveSecondsFromNow.getSeconds() + 5);

    await Notifications.scheduleNotificationAsync({
    content: notificationContent,
    trigger: {
        date: fiveSecondsFromNow,
    },
    });

    console.log("Time now is:", new Date());
    console.log('Test notification scheduled for:', fiveSecondsFromNow);
    return true;
  } catch (error) {
    console.error('Error scheduling test notification:', error);
    return false;
  }
}; 