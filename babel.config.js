module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: ['API_BASE_URL', 'APPS_SCRIPT_EMAIL_URL'],
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
