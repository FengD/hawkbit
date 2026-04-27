import { Button, Card, Checkbox, Input, Space, Table, Tooltip, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import { toErrorMessage } from '../utils/normalize';
import { TargetTypesModal } from '../components/shared/TargetTypesModal';

interface ConfigRow {
  key: string;
  value: string;
  isBoolean: boolean;
}

const isBooleanValue = (value: string): boolean => {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === 'false';
};

export const ConfigPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [targetTypesModalOpen, setTargetTypesModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await managementApi.listTenantConfigs();
      const mapped = Object.entries(result).map(([key, entry]) => {
        const value = String(entry?.value ?? '');
        return { key, value, isBoolean: isBooleanValue(value) };
      });
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
        render: (_, row) => {
          const currentValue = dirty[row.key] ?? row.value;

          if (row.isBoolean) {
            return (
              <Checkbox
                checked={currentValue.toLowerCase() === 'true'}
                onChange={(event) => {
                  setDirty((current) => ({ ...current, [row.key]: String(event.target.checked) }));
                }}
              >
                {currentValue.toLowerCase() === 'true' ? t('common.yes') : t('common.no')}
              </Checkbox>
            );
          }

          return (
            <Input
              value={currentValue}
              onChange={(event) => {
                setDirty((current) => ({ ...current, [row.key]: event.target.value }));
              }}
            />
          );
        },
      },
    ],
    [dirty, t],
  );

  return (
    <Card title={<Typography.Title level={4}>{t('page.config.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Tooltip title={t('common.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={() => void reload()} />
          </Tooltip>
          <Tooltip title={t('common.save')}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
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
            />
          </Tooltip>
          <Tooltip title={t('targetTypes.manageTargetTypes')}>
            <Button icon={<SettingOutlined />} onClick={() => setTargetTypesModalOpen(true)}>
              {t('targetTypes.manageTargetTypes')}
            </Button>
          </Tooltip>
        </Space>

        <Table
          rowKey={(row) => row.key}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 25, showSizeChanger: true }}
        />
      </Space>

      <TargetTypesModal open={targetTypesModalOpen} onClose={() => setTargetTypesModalOpen(false)} />
    </Card>
  );
};
