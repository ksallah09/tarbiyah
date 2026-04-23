const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGreenSplash(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const storyboardPath = path.join(
        config.modRequest.platformProjectRoot,
        'Tarbiyah/SplashScreen.storyboard'
      );

      let contents = fs.readFileSync(storyboardPath, 'utf8');

      // Replace systemBackgroundColor (white) with our named green color asset
      contents = contents.replace(
        /<color key="backgroundColor" systemColor="systemBackgroundColor"\/>/g,
        '<color key="backgroundColor" name="SplashScreenBackground"/>'
      );

      // Remove the systemColor resource declaration if present
      contents = contents.replace(
        /\s*<systemColor name="systemBackgroundColor">[\s\S]*?<\/systemColor>/g,
        ''
      );

      fs.writeFileSync(storyboardPath, contents);
      return config;
    },
  ]);
};
