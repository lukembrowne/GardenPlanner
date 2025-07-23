import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as SQLite from "expo-sqlite";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainScreen } from './src/screens/MainScreen';
import { TaskDetailsScreen } from './src/screens/TaskDetailsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CropsListScreen } from './src/screens/CropsListScreen';
import { CropEditScreen } from './src/screens/CropEditScreen';
import { BackupScreen } from './src/screens/BackupScreen';
import { NewYearSetupScreen } from './src/screens/NewYearSetupScreen';
import { initDatabase } from './src/services/database';
import { initCropDatabase } from './src/services/cropDatabase';
import { registerForPushNotifications, scheduleWeeklyNotification } from './src/services/notifications';

// Enable screens
import { enableScreens } from 'react-native-screens';
enableScreens();

// Adding to change version

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: 'white' },
      }}
    >
      <Stack.Screen 
        name="MainScreen" 
        component={MainScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="TaskDetails" 
        component={TaskDetailsScreen}
        options={{ 
          title: 'Task Details',
        }}
      />
    </Stack.Navigator>
  );
}

function CropsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: 'white' },
      }}
    >
      <Stack.Screen 
        name="CropsList" 
        component={CropsListScreen}
        options={{ 
          title: 'Crops',
        }}
      />
      <Stack.Screen 
        name="CropEdit" 
        component={CropEditScreen}
        options={{ 
          title: 'Edit Crop',
        }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: 'white' },
      }}
    >
      <Stack.Screen 
        name="SettingsScreen" 
        component={SettingsScreen}
        options={{ 
          title: 'Garden Settings',
        }}
      />
    
      <Stack.Screen 
        name="Backup" 
        component={BackupScreen}
        options={{ 
          title: 'Database Backup',
        }}
      />
      
      <Stack.Screen 
        name="NewYearSetup" 
        component={NewYearSetupScreen}
        options={{ 
          title: 'New Year Setup',
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const db = SQLite.openDatabaseSync("gardenplanner.db");
  useDrizzleStudio(db);

  React.useEffect(() => {
    const setupApp = async () => {
      try {
        await initDatabase();
        await initCropDatabase();
        await registerForPushNotifications();
        await scheduleWeeklyNotification();
      } catch (error) {
        console.error('Error setting up app:', error);
      }
    };
    setupApp();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                if (route.name === 'Main') {
                  iconName = focused ? 'leaf' : 'leaf-outline';
                } else if (route.name === 'Settings') {
                  iconName = focused ? 'settings' : 'settings-outline';
                } else if (route.name === 'Crops') {
                  iconName = focused ? 'apps' : 'apps-outline';
                }

                return <Ionicons name={iconName as any} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#4CAF50',
              tabBarInactiveTintColor: 'gray',
              headerStyle: {
                backgroundColor: 'white',
              },
              headerTitleStyle: {
                color: 'black',
              },
            })}
          >
            <Tab.Screen 
              name="Main" 
              component={MainStack}
              options={{ headerShown: false }}
            />
            <Tab.Screen 
              name="Crops" 
              component={CropsStack}
              options={{ headerShown: false }}
            />
            <Tab.Screen 
              name="Settings" 
              component={SettingsStack}
              options={{ headerShown: false }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
} 