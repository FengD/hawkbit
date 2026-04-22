import { Button, Card, Checkbox, Descriptions, Form, Input, Modal, Select, Space, Table, Typography, Upload, Tooltip, notification } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const SoftwareModulesPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HawkbitEntity | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<HawkbitEntity | null>(null);
  const [detailsArtifacts, setDetailsArtifacts] = useState<HawkbitEntity[]>([]);
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

      const [listResponse, typeResponse] = await Promise.all([
        managementApi.listSoftwareModules({
          offset: (page - 1) * pageSize,
          limit: pageSize,
          sort: `${sortField}:${sortOrder}`,
          q: filters.length > 0 ? filters.join(';') : undefined,
        }),
        managementApi.listSoftwareModuleTypes(),
      ]);
      setRows(listResponse.items);
      setTotal(listResponse.total);
      setTypes(typeResponse);
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

  const selectedRows = rows.filter((row) => selectedRowKeys.includes(String(row.id)));

  const showDetails = async (record: HawkbitEntity) => {
    setDetailsItem(record);
    setDetailsOpen(true);
    try {
      const artifacts = await managementApi.getSoftwareModuleArtifacts(String(record.id));
      setDetailsArtifacts(artifacts);
    } catch {
      setDetailsArtifacts([]);
    }
  };

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
      title: t('table.vendor'),
      dataIndex: 'vendor',
      sorter: false,
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
                  vendor: record.vendor,
                  description: record.description,
                  encrypted: Boolean(record.encrypted),
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
    <Card title={t('page.softwareModules.title')}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Select
            allowClear
            placeholder={t('softwareModules.filterType')}
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
            placeholder={t('softwareModules.searchName')}
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
          <Tooltip title={t('common.upload')}>
            <Upload
              maxCount={1}
              showUploadList={false}
              beforeUpload={async (file) => {
                if (selectedRows.length !== 1) {
                  notification.warning({ message: t('softwareModules.selectOneFirst') });
                  return Upload.LIST_IGNORE;
                }

                try {
                  await managementApi.uploadSoftwareModuleArtifact(String(selectedRows[0].id), file);
                  notification.success({ message: t('common.updated') });
                } catch (error) {
                  notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                }

                return Upload.LIST_IGNORE;
              }}
            >
              <Button icon={<UploadOutlined />} disabled={selectedRows.length !== 1} />
            </Upload>
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
                    await managementApi.deleteSoftwareModules(selectedRowKeys);
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
        />
      </Space>

      <Modal
        title={editingItem ? t('softwareModules.editTitle') : t('softwareModules.createTitle')}
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            const payload = {
              type: values.type,
              name: values.name,
              version: values.version,
              vendor: values.vendor,
              description: values.description,
              encrypted: Boolean(values.encrypted),
            };

            if (editingItem) {
              await managementApi.updateSoftwareModule(String(editingItem.id), payload);
            } else {
              await managementApi.createSoftwareModule(payload);
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
          <Form.Item name="vendor" label={t('table.vendor')}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="encrypted" label={t('softwareModules.encrypted')} valuePropName="checked">
            <Checkbox />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('softwareModules.details')}
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
              <Descriptions.Item label={t('table.vendor')}>{detailsItem.vendor || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('softwareModules.encrypted')}>
                {detailsItem.encrypted ? t('common.yes') : t('common.no')}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.description')} span={2}>
                {detailsItem.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.createdBy')}>{detailsItem.createdBy || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('table.createdAt')}>
                {detailsItem.createdAt ? dayjs(detailsItem.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.lastModifiedBy')}>{detailsItem.lastModifiedBy || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('table.lastModifiedAt')}>
                {detailsItem.lastModifiedAt ? dayjs(detailsItem.lastModifiedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5}>{t('softwareModules.artifacts')}</Typography.Title>
            <Table<HawkbitEntity>
              rowKey={(row) => String(row.id)}
              size="small"
              pagination={false}
              dataSource={detailsArtifacts}
              columns={[
                { title: t('table.id'), dataIndex: 'id' },
                { title: t('softwareModules.filename'), dataIndex: 'providedFilename' },
                { title: t('softwareModules.filesize'), dataIndex: 'size' },
                { title: t('softwareModules.hashes'), dataIndex: 'hashes' },
              ]}
              locale={{ emptyText: 'No artifacts' }}
            />
          </Space>
        )}
      </Modal>
    </Card>
  );
};