import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ded4d25121ff41a498f3e10fd0fa9c51',
  appName: 'ChaseHQ',
  webDir: 'dist',
  server: {
    url: 'https://ded4d251-21ff-41a4-98f3-e10fd0fa9c51.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0EA5E9',
    },
  },
};

export default config;
