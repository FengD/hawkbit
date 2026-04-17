import { Button, Card, Form, Input, Space, Typography, notification } from 'antd';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { toErrorMessage } from '../utils/normalize';

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth, login } = useAuth();

  if (auth) {
    return <Navigate to="/about" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3}>{t('app.login')}</Typography.Title>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            try {
              await login({
                username: values.username,
                password: values.password,
              });
              navigate('/about');
            } catch (error) {
              notification.error({ message: t('auth.failed'), description: toErrorMessage(error) });
            }
          }}
        >
          <Form.Item name="username" label={t('auth.username')} rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label={t('auth.password')} rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit">
              {t('auth.submit')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};
