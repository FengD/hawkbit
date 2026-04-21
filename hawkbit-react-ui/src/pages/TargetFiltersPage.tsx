import { Button, Card, Form, Input, Modal, Select, Space, Table, Tooltip, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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
  const [filterName, setFilterName] = useState('');
  const [distributionSets, setDistributionSets] = useState<HawkbitEntity[]>([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const q = filterName ? `name=rl=.*${filterName}.*` : undefined;
      const response = await managementApi.listTargetFilters({ offset: 0, limit: 200, sort: 'name:asc', q });
      setRows(response.items);
      setSelectedRowKeys([]);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadDistributionSets = async () => {
    try {
      const ds = await managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'name:asc' });
      setDistributionSets(ds.items);
    } catch {
      // best effort loading
    }
  };

  useEffect(() => {
    void loadData();
    void loadDistributionSets();
  }, []);

  useEffect(() => {
    void loadData();
  }, [filterName]);

  const formatDateTime = (value: number) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  };

  const columns: ColumnsType<HawkbitEntity> = [
    { title: t('table.id'), dataIndex: 'id' },
    { title: t('table.name'), dataIndex: 'name' },
    { title: t('table.query'), dataIndex: 'query' },
    {
      title: t('table.distributionSet'),
      dataIndex: 'distributionSet',
      render: (_, record) => {
        const ds = record.distributionSet;
        if (!ds) return '-';
        const name = ds.name || ds.id || '-';
        const version = ds.version || '';
        return `${name}:${version}`;
      },
    },
    {
      title: t('table.createdAt'),
      dataIndex: 'createdAt',
      render: (value: number) => formatDateTime(value),
    },
    {
      title: t('table.lastModifiedAt'),
      dataIndex: 'lastModifiedAt',
      render: (value: number) => formatDateTime(value),
    },
    {
      title: t('common.actions'),
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.edit')}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingItem(record);
                form.setFieldsValue({ name: record.name, query: record.query });
                setEditingOpen(true);
              }}
            />
          </Tooltip>
          {record.distributionSet && (
            <Tooltip title={t('targetFilters.cancelDs')}>
              <Button
                size="small"
                danger
                icon={<MinusCircleOutlined />}
                onClick={async () => {
                  Modal.confirm({
                    title: t('targetFilters.confirmCancelDs'),
                    onOk: async () => {
                      try {
                        await managementApi.cancelTargetFilterDistributionSet(String(record.id));
                        notification.success({ message: t('common.updated') });
                        await loadData();
                      } catch (error) {
                        notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                      }
                    },
                  });
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.targetFilters.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={t('targetFilters.filterName')}
            style={{ width: 240 }}
            onSearch={(value) => {
              setFilterName(value.trim());
            }}
            defaultValue={filterName}
          />
          <Tooltip title={t('common.refresh')}>
            <Button icon={<SyncOutlined />} onClick={() => void loadData()} />
          </Tooltip>
          <Tooltip title={t('common.create')}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingItem(null);
                form.resetFields();
                setEditingOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={t('targetFilters.assignDs')}>
            <Button
              icon={<AppstoreAddOutlined />}
              disabled={selectedRowKeys.length !== 1}
              onClick={() => {
                const selectedFilter = rows.find((row) => selectedRowKeys.includes(row.id));
                let distributionSetId = '';
                Modal.confirm({
                  title: t('targetFilters.assignDs'),
                  icon: null,
                  content: (
                    <Select
                      showSearch
                      style={{ width: '100%' }}
                      placeholder={t('targets.distributionSetId')}
                      options={distributionSets.map((item) => ({
                        value: String(item.id),
                        label: `${String(item.name ?? item.id)}:${String(item.version ?? '')}`,
                      }))}
                      onChange={(value) => {
                        distributionSetId = value;
                      }}
                    />
                  ),
                  onOk: async () => {
                    if (!distributionSetId || !selectedFilter) return;
                    try {
                      await managementApi.assignTargetFilterDistributionSet(String(selectedFilter.id), distributionSetId);
                      notification.success({ message: t('common.updated') });
                      await loadData();
                    } catch (error) {
                      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                    }
                  },
                });
              }}
            />
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <Button
              danger
              icon={<DeleteOutlined />}
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
            />
          </Tooltip>
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
