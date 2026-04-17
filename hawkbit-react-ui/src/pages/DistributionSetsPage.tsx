import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const DistributionSetsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [types, setTypes] = useState<HawkbitEntity[]>([]);
  const [softwareModules, setSoftwareModules] = useState<HawkbitEntity[]>([]);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HawkbitEntity | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listResponse, typeResponse, moduleResponse] = await Promise.all([
        managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'createdAt:desc' }),
        managementApi.listDistributionSetTypes(),
        managementApi.listSoftwareModules({ offset: 0, limit: 200, sort: 'name:asc' }),
      ]);
      setRows(listResponse.items);
      setTypes(typeResponse);
      setSoftwareModules(moduleResponse.items);
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
    { title: t('table.version'), dataIndex: 'version' },
    { title: t('table.type'), dataIndex: 'typeName' },
    {
      title: t('common.actions'),
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            setEditingItem(record);
            form.setFieldsValue({
              type: String(record.type ?? ''),
              name: record.name,
              version: record.version,
              description: record.description,
              requiredMigrationStep: Boolean(record.requiredMigrationStep),
            });
            setEditingOpen(true);
          }}
        >
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.distributionSets.title')}</Typography.Title>}>
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
            disabled={selectedRows.length !== 1}
            onClick={() => {
              let selectedIds: string[] = [];
              Modal.confirm({
                title: t('distributionSets.assignModules'),
                icon: null,
                content: (
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder={t('distributionSets.softwareModuleId')}
                    options={softwareModules.map((item) => ({
                      value: String(item.id),
                      label: `${String(item.name ?? item.id)}:${String(item.version ?? '')}`,
                    }))}
                    onChange={(values) => {
                      selectedIds = values;
                    }}
                  />
                ),
                onOk: async () => {
                  await managementApi.addSoftwareModulesToDistributionSet(String(selectedRows[0].id), selectedIds);
                  notification.success({ message: t('common.updated') });
                  await loadData();
                },
              });
            }}
          >
            {t('distributionSets.assignModules')}
          </Button>
          <Button
            danger
            disabled={selectedRowKeys.length === 0}
            onClick={() => {
              Modal.confirm({
                title: t('common.confirmDelete'),
                onOk: async () => {
                  await managementApi.deleteDistributionSets(selectedRowKeys);
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
        title={editingItem ? t('distributionSets.editTitle') : t('distributionSets.createTitle')}
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            const payload = {
              type: values.type,
              name: values.name,
              version: values.version,
              description: values.description,
              requiredMigrationStep: Boolean(values.requiredMigrationStep),
            };

            if (editingItem) {
              await managementApi.updateDistributionSet(String(editingItem.id), payload);
            } else {
              await managementApi.createDistributionSet(payload);
            }

            notification.success({ message: editingItem ? t('common.updated') : t('common.created') });
            setEditingOpen(false);
            await loadData();
          });
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="type" label={t('table.type')} rules={[{ required: true }]}>
            <Select options={types.map((item) => ({ value: String(item.key ?? item.id), label: String(item.name ?? item.id) }))} />
          </Form.Item>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="version" label={t('table.version')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="requiredMigrationStep" label={t('distributionSets.requiredMigrationStep')}>
            <Select options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
