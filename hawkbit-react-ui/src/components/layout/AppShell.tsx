import { BulbOutlined, GlobalOutlined, LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Select, Space, Switch, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { env } from '../../config/env';
import { withAlpha } from '../../config/themeColors';
import { useThemeMode } from '../../theme/useThemeMode';

const { Header, Content, Sider } = Layout;

export const AppShell = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, permissions } = useAuth();
  const { mode, toggleMode } = useThemeMode();

  const items = useMemo(
    () => [
      { key: '/targets', label: <Link to="/targets">{t('nav.targets')}</Link>, visible: permissions?.targets ?? true },
      // { key: '/target-groups', label: <Link to="/target-groups">{t('nav.targetGroups')}</Link>, visible: permissions?.targets ?? true },
      {
        key: '/target-filters',
        label: <Link to="/target-filters">{t('nav.targetFilters')}</Link>,
        visible: permissions?.targetFilters ?? true,
      },
      { key: '/rollouts', label: <Link to="/rollouts">{t('nav.rollouts')}</Link>, visible: permissions?.rollouts ?? true },
      {
        key: '/distribution-sets',
        label: <Link to="/distribution-sets">{t('nav.distributionSets')}</Link>,
        visible: permissions?.distributionSets ?? true,
      },
      {
        key: '/software-modules',
        label: <Link to="/software-modules">{t('nav.softwareModules')}</Link>,
        visible: permissions?.softwareModules ?? true,
      },
      { key: '/config', label: <Link to="/config">{t('nav.config')}</Link>, visible: permissions?.config ?? true },
      { key: '/about', label: <Link to="/about">{t('app.about')}</Link>, visible: true },
    ].filter((item) => item.visible),
    [permissions, t],
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250}>
        <div style={{ padding: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={env.appLogoPath}
            alt={env.appName}
            style={{ width: 28, height: 28, objectFit: 'contain' }}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <Typography.Text style={{ color: '#fff', fontWeight: 600 }}>{env.appName}</Typography.Text>
        </div>
        <Menu selectedKeys={[location.pathname]} mode="inline" items={items} theme="dark" />
      </Sider>
      <Layout>
        <Header style={{ borderBottom: `1px solid ${withAlpha(env.themeAccentColor, 0.6, '#e8d58a')}`, padding: '0 16px' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary">{env.appName}</Typography.Text>
            <Space>
              <Space>
                <BulbOutlined />
                <Typography.Text>{t('app.theme')}</Typography.Text>
                <Switch
                  checked={mode === 'dark'}
                  checkedChildren={t('theme.dark')}
                  unCheckedChildren={t('theme.light')}
                  onChange={toggleMode}
                />
              </Space>
              <GlobalOutlined />
              <Select
                value={i18n.language.startsWith('zh') ? 'zh' : 'en'}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'zh', label: '中文' },
                ]}
                onChange={(value) => {
                  void i18n.changeLanguage(value);
                }}
                style={{ width: 120 }}
              />
              <Button
                icon={<LogoutOutlined />}
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                {t('app.logout')}
              </Button>
            </Space>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
