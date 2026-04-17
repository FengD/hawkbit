import { Button, Card, Input, Space, Table, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import { toErrorMessage } from '../utils/normalize';

interface ConfigRow {
  key: string;
  value: string;
}

export const ConfigPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await managementApi.listTenantConfigs();
      const mapped = Object.entries(result).map(([key, entry]) => ({ key, value: String(entry?.value ?? '') }));
      setRows(mapped);
      setDirty({});
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const columns: ColumnsType<ConfigRow> = useMemo(
    () => [
      { title: t('config.key'), dataIndex: 'key', width: 320 },
      {
        title: t('common.value'),
        dataIndex: 'value',
        render: (_, row) => (
          <Input
            value={dirty[row.key] ?? row.value}
            onChange={(event) => {
              setDirty((current) => ({ ...current, [row.key]: event.target.value }));
            }}
          />
        ),
      },
    ],
    [dirty, t],
  );

  return (
    <Card title={<Typography.Title level={4}>{t('page.config.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Button onClick={() => void reload()}>{t('common.refresh')}</Button>
          <Button
            type="primary"
            disabled={Object.keys(dirty).length === 0}
            onClick={async () => {
              try {
                await Promise.all(Object.entries(dirty).map(([key, value]) => managementApi.updateTenantConfig(key, value)));
                notification.success({ message: t('common.updated') });
                await reload();
              } catch (error) {
                notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
              }
            }}
          >
            {t('common.save')}
          </Button>
        </Space>

        <Table
          rowKey={(row) => row.key}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 25, showSizeChanger: true }}
        />
      </Space>
    </Card>
  );
};
