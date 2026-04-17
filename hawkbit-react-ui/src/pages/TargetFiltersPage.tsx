import { Button, Card, Form, Input, Modal, Space, Table, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const TargetFiltersPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HawkbitEntity | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await managementApi.listTargetFilters({ offset: 0, limit: 200, sort: 'name:asc' });
      setRows(response.items);
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

  const columns: ColumnsType<HawkbitEntity> = [
    { title: t('table.id'), dataIndex: 'id' },
    { title: t('table.name'), dataIndex: 'name' },
    { title: t('table.query'), dataIndex: 'query' },
    { title: t('table.createdAt'), dataIndex: 'createdAt' },
    {
      title: t('common.actions'),
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            setEditingItem(record);
            form.setFieldsValue({ name: record.name, query: record.query });
            setEditingOpen(true);
          }}
        >
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.targetFilters.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Button onClick={() => void loadData()}>{t('common.refresh')}</Button>
          <Button
            type="primary"
            onClick={() => {
              setEditingItem(null);
              form.resetFields();
              setEditingOpen(true);
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
                  await managementApi.deleteTargetFilters(selectedRowKeys);
                  notification.success({ message: t('common.deleted') });
                  await loadData();
                },
              });
            }}
          >
            {t('common.delete')}
          </Button>
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
        title={editingItem ? t('targetFilters.editTitle') : t('targetFilters.createTitle')}
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            const payload = {
              name: values.name,
              query: values.query,
            };

            if (editingItem) {
              await managementApi.updateTargetFilter(String(editingItem.id), payload);
            } else {
              await managementApi.createTargetFilter(payload);
            }
            notification.success({ message: editingItem ? t('common.updated') : t('common.created') });
            setEditingOpen(false);
            await loadData();
          });
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="query" label={t('table.query')} rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
