export const env = {
  hawkbitServerUrl: (import.meta.env.VITE_HAWKBIT_SERVER_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080',
  defaultLocale: (import.meta.env.VITE_DEFAULT_LOCALE as string | undefined) || 'en',
  appName: (import.meta.env.VITE_APP_NAME as string | undefined) || 'Eclipse hawkBit UI',
  appLogoPath: (import.meta.env.VITE_APP_LOGO_PATH as string | undefined) || '/vite.svg',
  themePrimaryColor: (import.meta.env.VITE_THEME_PRIMARY as string | undefined) || '#552583',
  themeAccentColor: (import.meta.env.VITE_THEME_ACCENT as string | undefined) || '#FDB927',
  aboutMarkdownPath: (import.meta.env.VITE_ABOUT_MARKDOWN_PATH as string | undefined) || '/about.md',
};

export const buildApiUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${env.hawkbitServerUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
