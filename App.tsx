import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import AppNavigator, {navigationRef} from './src/navigation/AppNavigator';
import {PreferencesProvider} from './src/theme/PreferencesContext';
import {PostsProvider} from './src/context/PostsContext';

function Root(): React.JSX.Element {
  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
    </NavigationContainer>
  );
}

function App(): React.JSX.Element {
  return (
    <PreferencesProvider>
      <PostsProvider>
        <Root />
      </PostsProvider>
    </PreferencesProvider>
  );
}

export default App;
