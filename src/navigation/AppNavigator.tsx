import React, {useEffect, useState} from 'react';
import {supabase} from '../services/supabase';
import OnboardingScreen from '../screens/OnboardingScreen';
import SignInScreen from '../screens/SignInScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import HomeScreen from '../screens/HomeScreen';
import FeedScreen from '../screens/FeedScreen';
import NewPostScreen from '../screens/NewPostScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import AlertsScreen from '../screens/AlertsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ElectionHubScreen from '../screens/election/ElectionHubScreen';
import ElectionBallotScreen from '../screens/election/ElectionBallotScreen';
import VerifyBallotScreen from '../screens/election/VerifyBallotScreen';
import VoteSuccessScreen from '../screens/election/VoteSuccessScreen';
import LiveResultsScreen from '../screens/election/LiveResultsScreen';

// Admin Suite Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUserVerificationScreen from '../screens/admin/AdminUserVerificationScreen';
import AdminContentModerationScreen from '../screens/admin/AdminContentModerationScreen';
import AdminElectionManagerScreen from '../screens/admin/AdminElectionManagerScreen';
import AdminCreateElectionScreen from '../screens/admin/AdminCreateElectionScreen';
import AdminBroadcastAlertScreen from '../screens/admin/AdminBroadcastAlertScreen';
import AdminMyPostsScreen from '../screens/admin/AdminMyPostsScreen';

import {PostsProvider} from '../context/PostsContext';
import {AlertsProvider, useAlerts} from '../context/AlertsContext';
import Icon from 'react-native-vector-icons/Feather';
import {colors} from '../theme/colors.ts';
import {View} from 'react-native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';

export type MainTabParamList = {
  Feed: undefined;
  Election: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  Welcome: undefined;
  Home: undefined;
  NewPost: undefined;
  Settings: undefined;
  PostDetail: {post?: any};
  UserProfile: {userId: string};
  // Admin Module Screens
  AdminDashboard: undefined;
  AdminUserVerification: undefined;
  AdminContentModeration: undefined;
  AdminElectionManager: undefined;
  AdminCreateElection: undefined;
  AdminBroadcastAlert: undefined;
  AdminMyPosts: undefined;
  AdminLiveResults: {electionId?: string};
};

export type ElectionStackParamList = {
  ElectionHub: undefined;
  ElectionBallot: undefined;
  VerifyBallot: {candidate?: any; electionId?: string};
  VoteSuccess: {receiptId?: string | null; isDuplicate?: boolean; electionId?: string};
  LiveResults: {electionId?: string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const ElectionNav = createNativeStackNavigator<ElectionStackParamList>();

function ElectionStack() {
  return (
    <ElectionNav.Navigator
      initialRouteName="ElectionHub"
      screenOptions={{headerShown: false}}>
      <ElectionNav.Screen name="ElectionHub" component={ElectionHubScreen} />
      <ElectionNav.Screen
        name="ElectionBallot"
        component={ElectionBallotScreen}
      />
      <ElectionNav.Screen name="VerifyBallot" component={VerifyBallotScreen} />
      <ElectionNav.Screen name="VoteSuccess" component={VoteSuccessScreen} />
      <ElectionNav.Screen name="LiveResults" component={LiveResultsScreen} />
    </ElectionNav.Navigator>
  );
}

function FeedTabIcon({color, size}: {color: string; size: number}) {
  return <Icon name="home" color={color} size={size} />;
}
function ElectionTabIcon({color, size}: {color: string; size: number}) {
  return <Icon name="check-square" color={color} size={size} />;
}
function AlertsTabIcon({color, size}: {color: string; size: number}) {
  const {unreadCount} = useAlerts();
  return (
    <View style={{width: size, height: size, justifyContent: 'center', alignItems: 'center'}}>
      <Icon name="bell" color={color} size={size} />
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.accent,
          }}
        />
      )}
    </View>
  );
}
function ProfileTabIcon({color, size}: {color: string; size: number}) {
  return <Icon name="user" color={color} size={size} />;
}

function SettingsSlot({navigation, route}: any) {
  return <SettingsScreen navigation={navigation} route={route} />;
}

function MainTabs() {
  return (
    <AlertsProvider>
      <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
      }}>
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{tabBarIcon: FeedTabIcon}}
      />
      <Tab.Screen
        name="Election"
        component={ElectionStack}
        options={{tabBarIcon: ElectionTabIcon}}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{tabBarIcon: AlertsTabIcon}}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsSlot}
        options={{tabBarIcon: ProfileTabIcon}}
      />
      </Tab.Navigator>
    </AlertsProvider>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList>('Onboarding');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: {session},
      } = await supabase.auth.getSession();
      if (active) {
        setInitialRoute(session ? 'Home' : 'Onboarding');
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return null;
  }

  return (
    <PostsProvider>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{headerShown: false}}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Stack.Screen name="Welcome" component={HomeScreen} />
        <Stack.Screen name="Home" component={MainTabs} />
        <Stack.Screen
          name="NewPost"
          component={NewPostScreen}
          options={{presentation: 'modal'}}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />

        {/* Admin Navigation Screens */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen
          name="AdminUserVerification"
          component={AdminUserVerificationScreen}
        />
        <Stack.Screen
          name="AdminContentModeration"
          component={AdminContentModerationScreen}
        />
        <Stack.Screen
          name="AdminElectionManager"
          component={AdminElectionManagerScreen}
        />
        <Stack.Screen
          name="AdminCreateElection"
          component={AdminCreateElectionScreen}
        />
        <Stack.Screen
          name="AdminBroadcastAlert"
          component={AdminBroadcastAlertScreen}
        />
        <Stack.Screen name="AdminMyPosts" component={AdminMyPostsScreen} />
        <Stack.Screen name="AdminLiveResults" component={LiveResultsScreen} />
      </Stack.Navigator>
    </PostsProvider>
  );
}

export type {NativeStackScreenProps, BottomTabScreenProps};
