import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

interface MetadataRow {
  key: string;
  value: string;
}

interface ActionEntry {
  id: number;
  status: string;
  type: string;
  lastStatus: string;
  startedAt: number;
  finishedAt: number;
  forced: boolean;
  messages: Array<{ type: string; content: string }>;
}

export const TargetsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [query, setQuery] = useState('');
  const [targetTypes, setTargetTypes] = useState<HawkbitEntity[]>([]);
  const [distributionSets, setDistributionSets] = useState<HawkbitEntity[]>([]);
  const [editingTarget, setEditingTarget] = useState<HawkbitEntity | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsPayload, setActionsPayload] = useState<ActionEntry[] | null>(null);

  const [form] = Form.useForm();

  const loadOptions = async () => {
    try {
      const [types, ds] = await Promise.all([
        managementApi.listTargetTypes(),
        managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'name:asc' }),
      ]);
      setTargetTypes(types);
      setDistributionSets(ds.items);
    } catch {
      // best effort options loading
    }
  };

  const loadTargets = async () => {
    setLoading(true);
    try {
      const response = await managementApi.listTargets({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort: 'lastModifiedAt:desc',
        q: query || undefined,
      });
      setRows(response.items);
      setTotal(response.total);
      setSelectedRowKeys([]);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [page, pageSize, query]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowKeys.includes(String(row.id))), [rows, selectedRowKeys]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    if (pagination.current !== page) {
      setPage(pagination.current || 1);
    }
    if (pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize || 20);
      setPage(1);
    }
  };

  const getSyncStatus = (target: HawkbitEntity) => {
    const updateStatus = target.updateStatus?.toLowerCase() || '';
    if (updateStatus === 'in_sync' || updateStatus === 'registered') {
      return {
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        text: t('targets.syncInSync'),
        color: 'green',
      };
    } else if (updateStatus === 'pending') {
      return {
        icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
        text: t('targets.syncPending'),
        color: 'orange',
      };
    } else if (updateStatus === 'error') {
      return {
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: t('targets.syncError'),
        color: 'red',
      };
    }
    return {
      icon: <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />,
      text: t('targets.syncUnknown'),
      color: 'default',
    };
  };

  const formatDateTime = (value: number) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  };

  const loadActions = async (targetId: string | number) => {
    try {
      const response = await managementApi.getTargetActions(String(targetId));
      const actions = (response.data?.content || []) as ActionEntry[];
      setActionsPayload(actions);
      setActionsOpen(true);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const columns: ColumnsType<HawkbitEntity> = [
    { title: t('table.controllerId'), dataIndex: 'controllerId', sorter: true },
    { title: t('table.name'), dataIndex: 'name', sorter: true },
    {
      title: t('table.type'),
      dataIndex: 'targetTypeName',
      render: (_, record) => record.targetTypeName || '-',
    },
    {
      title: t('targets.syncStatus'),
      dataIndex: 'updateStatus',
      render: (_, record) => {
        const status = getSyncStatus(record);
        return (
          <Tooltip title={status.text}>
            {status.icon}
          </Tooltip>
        );
      },
    },
    {
      title: t('table.status'),
      dataIndex: 'updateStatus',
      render: (_, record) => {
        const status = getSyncStatus(record);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: t('targets.installedDs'),
      render: (_, record) => {
        const installedDs = record.installedDistributionSet;
        if (!installedDs) return '-';
        const name = installedDs.name || installedDs.id || '-';
        const version = installedDs.version || '';
        return (
          <Space direction="vertical" size="small">
            <span>{name}</span>
            {version && <span style={{ fontSize: 12, color: '#999' }}>v{version}</span>}
          </Space>
        );
      },
    },
    {
      title: t('targets.assignedDsInfo'),
      render: (_, record) => {
        const assignedDs = record.assignedDistributionSet;
        if (!assignedDs) return '-';
        const name = assignedDs.name || assignedDs.id || '-';
        const version = assignedDs.version || '';
        return (
          <Space direction="vertical" size="small">
            <span>{name}</span>
            {version && <span style={{ fontSize: 12, color: '#999' }}>v{version}</span>}
          </Space>
        );
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
                setEditingTarget(record);
                form.setFieldsValue({
                  controllerId: record.controllerId,
                  name: record.name,
                  description: record.description,
                  group: record.group,
                  targetType: record.targetType,
                });
                setEditingOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={t('targets.actionHistory')}>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => void loadActions(record.controllerId ?? record.id)}
            />
          </Tooltip>
          <Tooltip title={t('targets.metadata')}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={async () => {
                const selected = record;
                try {
                  const response = await managementApi.getTargetMetadata(String(selected.controllerId ?? selected.id));
                  const content = (response.data?.content ?? []) as Array<{ key: string; value: string }>;
                  setMetadataRows(content);
                  setEditingTarget(selected);
                  setMetadataOpen(true);
                } catch (error) {
                  notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.targets.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={t('targets.searchHint')}
            style={{ width: 320 }}
            onSearch={(value) => {
              setPage(1);
              setQuery(value.trim());
            }}
          />
          <Tooltip title={t('common.refresh')}>
            <Button icon={<SyncOutlined />} onClick={() => void loadTargets()} />
          </Tooltip>
          <Tooltip title={t('common.create')}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingTarget(null);
                form.resetFields();
                setEditingOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={t('targets.assignDs')}>
            <Button
              icon={<AppstoreAddOutlined />}
              disabled={selectedRows.length !== 1}
              onClick={() => {
                let distributionSetId = '';
                Modal.confirm({
                  title: t('targets.assignDs'),
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
                    await managementApi.assignDistributionSet(
                      String(selectedRows[0].controllerId ?? selectedRows[0].id),
                      distributionSetId,
                    );
                    notification.success({ message: t('common.updated') });
                    await loadTargets();
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
                    await managementApi.deleteTargets(selectedRowKeys);
                    notification.success({ message: t('common.deleted') });
                    await loadTargets();
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
          scroll={{ x: 1400 }}
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
        title={editingTarget ? t('targets.editTarget') : t('targets.createTarget')}
        open={editingOpen}
        onCancel={() => setEditingOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            try {
              const payload = {
                controllerId: values.controllerId,
                name: values.name,
                description: values.description,
                group: values.group,
                targetType: values.targetType ? Number(values.targetType) : undefined,
              };

              if (editingTarget) {
                await managementApi.updateTarget(String(editingTarget.controllerId ?? editingTarget.id), payload);
              } else {
                await managementApi.createTarget(payload);
              }
              notification.success({ message: editingTarget ? t('common.updated') : t('common.created') });
              setEditingOpen(false);
              await loadTargets();
            } catch (error) {
              notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
            }
          });
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="controllerId" label={t('table.controllerId')} rules={[{ required: true }]}>
            <Input disabled={Boolean(editingTarget)} />
          </Form.Item>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="group" label={t('targetGroups.groupName')}>
            <Input />
          </Form.Item>
          <Form.Item name="targetType" label={t('table.type')}>
            <Select
              allowClear
              options={targetTypes.map((item) => ({ value: String(item.id), label: String(item.name ?? item.id) }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${t('targets.metadata')} #${String(editingTarget?.controllerId ?? editingTarget?.id ?? '')}`}
        open={metadataOpen}
        onCancel={() => setMetadataOpen(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Table<MetadataRow>
            rowKey={(row) => row.key}
            size="small"
            dataSource={metadataRows}
            pagination={false}
            columns={[
              { title: t('targets.metadataKey'), dataIndex: 'key' },
              { title: t('targets.metadataValue'), dataIndex: 'value' },
              {
                title: t('common.actions'),
                render: (_, row) => (
                  <Button
                    danger
                    size="small"
                    onClick={async () => {
                      if (!editingTarget) {
                        return;
                      }
                      await managementApi.deleteTargetMetadata(String(editingTarget.controllerId ?? editingTarget.id), row.key);
                      setMetadataRows((current) => current.filter((item) => item.key !== row.key));
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                ),
              },
            ]}
          />
          <Button
            type="dashed"
            onClick={() => {
              let key = '';
              let value = '';
              Modal.confirm({
                title: t('targets.addMetadata'),
                icon: null,
                content: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input placeholder={t('targets.metadataKey')} onChange={(event) => (key = event.target.value)} />
                    <Input placeholder={t('targets.metadataValue')} onChange={(event) => (value = event.target.value)} />
                  </Space>
                ),
                onOk: async () => {
                  if (!editingTarget || !key.trim()) {
                    return;
                  }
                  await managementApi.createTargetMetadata(String(editingTarget.controllerId ?? editingTarget.id), key.trim(), value);
                  setMetadataRows((current) => [...current.filter((item) => item.key !== key.trim()), { key: key.trim(), value }]);
                },
              });
            }}
          >
            {t('targets.addMetadata')}
          </Button>
        </Space>
      </Modal>

      <Modal title={t('targets.actionHistory')} open={actionsOpen} onCancel={() => setActionsOpen(false)} footer={null} width={980}>
        {!actionsPayload || actionsPayload.length === 0 ? (
          <Typography.Text type="secondary">{t('targets.noActions')}</Typography.Text>
        ) : (
          <Table<ActionEntry>
            rowKey={(row) => row.id}
            size="small"
            pagination={false}
            dataSource={actionsPayload}
            columns={[
              { title: t('targets.actionId'), dataIndex: 'id', width: 80 },
              {
                title: t('targets.actionStatus'),
                dataIndex: 'status',
                width: 100,
                render: (status: string) => {
                  const statusMap: Record<string, { color: string; text: string }> = {
                    SCHEDULED: { color: 'blue', text: 'Scheduled' },
                    RUNNING: { color: 'green', text: 'Running' },
                    FINISHED: { color: 'purple', text: 'Finished' },
                    ERROR: { color: 'red', text: 'Error' },
                    CANCELLED: { color: 'orange', text: 'Cancelled' },
                    DOWNLOADED: { color: 'cyan', text: 'Downloaded' },
                  };
                  const info = statusMap[status] || { color: 'default', text: status };
                  return <Tag color={info.color}>{info.text}</Tag>;
                },
              },
              {
                title: t('targets.actionType'),
                dataIndex: 'type',
                width: 100,
                render: (type: string) => {
                  const typeMap: Record<string, string> = {
                    FORCED: 'Forced',
                    SOFT: 'Soft',
                    DOWNLOAD_ONLY: 'Download Only',
                    TIMEFORCED: 'Time Forced',
                  };
                  return typeMap[type] || type;
                },
              },
              {
                title: t('targets.actionForced'),
                dataIndex: 'forced',
                width: 80,
                render: (forced: boolean) => (forced ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>),
              },
              { title: t('targets.actionStartedAt'), dataIndex: 'startedAt', render: formatDateTime, width: 150 },
              { title: t('targets.actionFinishedAt'), dataIndex: 'finishedAt', render: formatDateTime, width: 150 },
              {
                title: t('targets.actionMessages'),
                dataIndex: 'messages',
                render: (messages: Array<{ type: string; content: string }>) => (
                  <Space direction="vertical" size="small">
                    {messages?.map((msg, idx) => (
                      <Tag key={idx} color={msg.type === 'error' ? 'red' : 'default'}>
                        {msg.content}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </Card>
  );
};