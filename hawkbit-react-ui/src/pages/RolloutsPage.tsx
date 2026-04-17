import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const RolloutsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [targetFilters, setTargetFilters] = useState<HawkbitEntity[]>([]);
  const [distributionSets, setDistributionSets] = useState<HawkbitEntity[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [rollouts, filters, ds] = await Promise.all([
        managementApi.listRollouts({ offset: 0, limit: 200, sort: 'createdAt:desc' }),
        managementApi.listTargetFilters({ offset: 0, limit: 200, sort: 'name:asc' }),
        managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'name:asc' }),
      ]);
      setRows(rollouts.items);
      setTargetFilters(filters.items);
      setDistributionSets(ds.items);
      setSelectedRowKeys([]);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowKeys.includes(String(row.id))), [rows, selectedRowKeys]);

  const columns: ColumnsType<HawkbitEntity> = [
    { title: t('table.id'), dataIndex: 'id' },
    { title: t('table.name'), dataIndex: 'name' },
    { title: t('table.status'), dataIndex: 'status' },
    { title: t('rollouts.groups'), dataIndex: 'totalGroups' },
    { title: t('rollouts.targets'), dataIndex: 'totalTargets' },
    {
      title: t('common.actions'),
      render: (_, record) => (
        <Space>
          {(['start', 'pause', 'resume', 'stop', 'retry', 'triggerNextGroup'] as const).map((action) => (
            <Button
              key={action}
              size="small"
              onClick={async () => {
                try {
                  await managementApi.rolloutAction(String(record.id), action);
                  notification.success({ message: t('common.updated') });
                  await loadData();
                } catch (error) {
                  notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                }
              }}
            >
              {t(`rollouts.actions.${action}`)}
            </Button>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.rollouts.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Button onClick={() => void loadData()}>{t('common.refresh')}</Button>
          <Button
            type="primary"
            onClick={() => {
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            {t('common.create')}
          </Button>
          <Button
            danger
            disabled={selectedRowKeys.length === 0}
            onClick={() => {
              Modal.confirm({
                title: t('common.confirmDelete'),
                onOk: async () => {
                  await managementApi.deleteRollouts(selectedRowKeys);
                  notification.success({ message: t('common.deleted') });
                  await loadData();
                },
              });
            }}
          >
            {t('common.delete')}
          </Button>
          {selectedRows.length === 1 && <Typography.Text type="secondary">#{String(selectedRows[0].id)}</Typography.Text>}
        </Space>

        <Table<HawkbitEntity>
          rowKey={(row) => String(row.id)}
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as Array<string | number>),
          }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Space>

      <Modal
        title={t('rollouts.createTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            const filter = targetFilters.find((item) => String(item.id) === String(values.targetFilterId));
            const payload = {
              name: values.name,
              description: values.description,
              distributionSetId: Number(values.distributionSetId),
              targetFilterQuery: String(filter?.query ?? ''),
              type: values.actionType,
              amountGroups: values.amountGroups,
              successCondition: {
                condition: 'THRESHOLD',
                value: String(values.successThreshold),
              },
              errorCondition: {
                condition: 'THRESHOLD',
                value: String(values.errorThreshold),
              },
              errorAction: {
                action: 'PAUSE',
                expression: '',
              },
              dynamic: Boolean(values.dynamic),
              startAt: values.startAt ? dayjs(values.startAt).valueOf() : undefined,
            };

            await managementApi.createRollout(payload);
            notification.success({ message: t('common.created') });
            setCreateOpen(false);
            await loadData();
          });
        }}
      >
        <Form layout="vertical" form={form} initialValues={{ actionType: 'FORCED', amountGroups: 1, successThreshold: 100, errorThreshold: 10, dynamic: false }}>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="distributionSetId" label={t('table.distributionSet')} rules={[{ required: true }]}>
            <Select
              options={distributionSets.map((item) => ({
                value: String(item.id),
                label: `${String(item.name ?? item.id)}:${String(item.version ?? '')}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="targetFilterId" label={t('rollouts.targetFilter')} rules={[{ required: true }]}>
            <Select options={targetFilters.map((item) => ({ value: String(item.id), label: String(item.name ?? item.id) }))} />
          </Form.Item>
          <Form.Item name="actionType" label={t('rollouts.actionType')} rules={[{ required: true }]}>
            <Select options={[{ value: 'FORCED' }, { value: 'SOFT' }, { value: 'DOWNLOAD_ONLY' }, { value: 'TIMEFORCED' }]} />
          </Form.Item>
          <Form.Item name="amountGroups" label={t('rollouts.groups')}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="successThreshold" label={t('rollouts.successThreshold')}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="errorThreshold" label={t('rollouts.errorThreshold')}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dynamic" label={t('rollouts.dynamic')}>
            <Select options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
