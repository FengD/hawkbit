import { Button, Card, Checkbox, Descriptions, Form, Input, Modal, Select, Space, Table, Tooltip, Typography, notification } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const DistributionSetsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [types, setTypes] = useState<HawkbitEntity[]>([]);
  const [softwareModules, setSoftwareModules] = useState<HawkbitEntity[]>([]);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HawkbitEntity | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<HawkbitEntity | null>(null);
  const [detailsModules, setDetailsModules] = useState<HawkbitEntity[]>([]);
  const [filterType, setFilterType] = useState<string | undefined>();
  const [searchName, setSearchName] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: string[] = [];
      if (filterType) {
        // RSQL format: type.key==TYPE_KEY
        filters.push(`type.key==${filterType}`);
      }
      if (searchName) {
        // RSQL format: name==*value* for wildcard matching
        filters.push(`name==*${searchName}*`);
      }

      const [listResponse, typeResponse, moduleResponse] = await Promise.all([
        managementApi.listDistributionSets({
          offset: (page - 1) * pageSize,
          limit: pageSize,
          sort: `${sortField}:${sortOrder}`,
          q: filters.length > 0 ? filters.join(';') : undefined,
        }),
        managementApi.listDistributionSetTypes(),
        managementApi.listSoftwareModules({ offset: 0, limit: 200, sort: 'name:asc' }),
      ]);
      setRows(listResponse.items);
      setTotal(listResponse.total);
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
  }, [page, pageSize, filterType, searchName, sortOrder, sortField]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowKeys.includes(String(row.id))), [rows, selectedRowKeys]);

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, (string | number)[] | null>,
    sorter: {
      field?: string;
      order?: 'ascend' | 'descend';
    } | any,
  ) => {
    if (pagination.current !== page) {
      setPage(pagination.current || 1);
    }
    if (pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize || 20);
      setPage(1);
    }
    if (sorter?.field && sorter?.order) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const showDetails = async (record: HawkbitEntity) => {
    setDetailsItem(record);
    setDetailsOpen(true);
    try {
      const modules = await managementApi.getDistributionSetModules(record.id as number);
      setDetailsModules(modules);
    } catch {
      setDetailsModules([]);
    }
  };

  const columns: ColumnsType<HawkbitEntity> = [
    {
      title: t('table.id'),
      dataIndex: 'id',
      sorter: true,
      sortOrder: sortField === 'id' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.version'),
      dataIndex: 'version',
      sorter: true,
      sortOrder: sortField === 'version' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.type'),
      dataIndex: 'typeName',
      sorter: false,
    },
    {
      title: t('table.createdAt'),
      dataIndex: 'createdAt',
      sorter: true,
      sortOrder: sortField === 'createdAt' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: number) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
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
                form.setFieldsValue({
                  type: String(record.type ?? ''),
                  name: record.name,
                  version: record.version,
                  description: record.description,
                  requiredMigrationStep: Boolean(record.requiredMigrationStep),
                });
                setEditingOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={t('common.details')}>
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => void showDetails(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.distributionSets.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Select
            allowClear
            placeholder={t('distributionSets.filterType')}
            style={{ width: 200 }}
            options={types.map((item) => ({ value: String(item.key ?? item.id), label: String(item.name ?? item.id) }))}
            onChange={(value) => {
              setFilterType(value);
              setPage(1);
            }}
            value={filterType}
          />
          <Input.Search
            allowClear
            placeholder={t('distributionSets.searchName')}
            style={{ width: 240 }}
            onSearch={(value) => {
              setSearchName(value.trim());
              setPage(1);
            }}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
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
          <Tooltip title={t('distributionSets.assignModules')}>
            <Button
              icon={<AppstoreAddOutlined />}
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
                    try {
                      await managementApi.addSoftwareModulesToDistributionSet(String(selectedRows[0].id), selectedIds);
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
                    await managementApi.deleteDistributionSets(selectedRowKeys);
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
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (totalCount) => `Total ${totalCount} items`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onDoubleClick: () => void showDetails(record),
          })}
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
          <Form.Item name="requiredMigrationStep" label={t('distributionSets.requiredMigrationStep')} valuePropName="checked">
            <Checkbox />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('distributionSets.details')}
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={null}
        width={800}
      >
        {detailsItem && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t('table.id')}>{detailsItem.id}</Descriptions.Item>
              <Descriptions.Item label={t('table.name')}>{detailsItem.name}</Descriptions.Item>
              <Descriptions.Item label={t('table.version')}>{detailsItem.version}</Descriptions.Item>
              <Descriptions.Item label={t('table.type')}>{detailsItem.typeName}</Descriptions.Item>
              <Descriptions.Item label={t('table.createdAt')}>
                {detailsItem.createdAt ? dayjs(detailsItem.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('distributionSets.requiredMigrationStep')}>
                {detailsItem.requiredMigrationStep ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.description')} span={2}>
                {detailsItem.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5}>{t('distributionSets.assignedModules')}</Typography.Title>
            <Table<HawkbitEntity>
              rowKey={(row) => String(row.id)}
              size="small"
              pagination={false}
              dataSource={detailsModules}
              columns={[
                { title: t('table.id'), dataIndex: 'id' },
                { title: t('table.name'), dataIndex: 'name' },
                { title: t('table.version'), dataIndex: 'version' },
                { title: t('table.type'), dataIndex: 'typeName' },
              ]}
              locale={{ emptyText: 'No software modules assigned' }}
            />
          </Space>
        )}
      </Modal>
    </Card>
  );
};