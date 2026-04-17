import { ConfigProvider, Result, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { env } from './config/env';
import { withAlpha } from './config/themeColors';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AboutPage } from './pages/AboutPage';
import { ConfigPage } from './pages/ConfigPage';
import { DistributionSetsPage } from './pages/DistributionSetsPage';
import { LoginPage } from './pages/LoginPage';
import { RolloutsPage } from './pages/RolloutsPage';
import { SoftwareModulesPage } from './pages/SoftwareModulesPage';
import { TargetFiltersPage } from './pages/TargetFiltersPage';
import { TargetGroupsPage } from './pages/TargetGroupsPage';
import { TargetsPage } from './pages/TargetsPage';
import { useThemeMode } from './theme/useThemeMode';

function App() {
  const { i18n, t } = useTranslation();
  const { permissions } = useAuth();
  const { mode } = useThemeMode();

  const antLocale = useMemo(() => (i18n.language.startsWith('zh') ? zhCN : enUS), [i18n.language]);

  const hasAnyPermission = useMemo(() => {
    if (!permissions) {
      return true;
    }

    return Object.values(permissions).some(Boolean);
  }, [permissions]);

  const antTheme = useMemo(
    () => ({
      algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: env.themePrimaryColor,
        colorInfo: env.themePrimaryColor,
        colorWarning: env.themeAccentColor,
        colorSuccess: '#52c41a',
        colorLink: env.themePrimaryColor,
        borderRadius: 10,
      },
      components: {
        Layout: {
          siderBg: env.themePrimaryColor,
          headerBg: mode === 'dark' ? '#151515' : withAlpha(env.themeAccentColor, 0.18, '#fff9e8'),
          triggerBg: env.themePrimaryColor,
          triggerColor: env.themeAccentColor,
        },
        Menu: {
          darkItemBg: env.themePrimaryColor,
          darkItemSelectedBg: withAlpha(env.themeAccentColor, 0.28, '#6f42c1'),
          darkItemColor: '#f7f7f7',
        },
      },
    }),
    [mode],
  );

  return (
    <ConfigProvider locale={antLocale} theme={antTheme}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/targets" replace />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="target-groups" element={<TargetGroupsPage />} />
          <Route path="target-filters" element={<TargetFiltersPage />} />
          <Route path="rollouts" element={<RolloutsPage />} />
          <Route path="distribution-sets" element={<DistributionSetsPage />} />
          <Route path="software-modules" element={<SoftwareModulesPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route
            path="forbidden"
            element={<Result status="403" title="403" subTitle={t('common.noPermission')} />}
          />
        </Route>
        <Route path="*" element={<Navigate to={hasAnyPermission ? '/targets' : '/forbidden'} replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
