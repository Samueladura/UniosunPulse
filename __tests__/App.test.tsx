/**
 * @format
 */

import 'react-native';
import React from 'react';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({children}: {children?: React.ReactNode}) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../src/navigation/AppNavigator', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('AppNavigator', null),
  };
});

jest.mock('../src/theme/PreferencesContext', () => {
  const React = require('react');
  return {
    PreferencesProvider: ({children}: {children?: React.ReactNode}) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../src/context/PostsContext', () => {
  const React = require('react');
  return {
    PostsProvider: ({children}: {children?: React.ReactNode}) =>
      React.createElement(React.Fragment, null, children),
  };
});

import App from '../App';

import {it, jest} from '@jest/globals';
import renderer from 'react-test-renderer';

it('renders correctly', () => {
  renderer.create(<App />);
});
