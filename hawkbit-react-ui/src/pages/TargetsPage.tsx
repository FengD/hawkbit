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
  Tabs,
  Tooltip,
  Typography,
  notification,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
  SyncOutlined,
  StopOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

const formatDateTime = (value: number) => {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
};

interface TargetDetailsProps {
  target: HawkbitEntity;
  onClose: () => void;
}

interface ActionListEntry {
  id: number;
  type: string;
  active: boolean;
  status: string;
  forceType?: string;
  lastModifiedAt: number;
  createdAt: number;
  weight?: number;
  rollout?: number;
  rolloutName?: string;
  distributionSet?: {
    id: number;
    name: string;
    version: string;
  };
}

interface ActionStatusEntry {
  id: number;
  type: string;
  reportedAt: number;
  messages: string[];
  code?: number;
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
  const [tags, setTags] = useState<HawkbitEntity[]>([]);
  const [filterTag, setFilterTag] = useState<string | undefined>();
  const [editingTarget, setEditingTarget] = useState<HawkbitEntity | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<HawkbitEntity | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sortField, setSortField] = useState<string>('lastModifiedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [assignDsOpen, setAssignDsOpen] = useState(false);
  const [assignDsTarget, setAssignDsTarget] = useState<HawkbitEntity | null>(null);
  const [assignDsForm] = Form.useForm();

  const [form] = Form.useForm();

  const loadOptions = async () => {
    try {
      const [types, ds, allTags] = await Promise.all([
        managementApi.listTargetTypes(),
        managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'name:asc' }),
        managementApi.listTargetTags(),
      ]);
      setTargetTypes(types);
      setDistributionSets(ds.items);
      setTags(allTags);
    } catch {
      // best effort options loading
    }
  };

  const loadTargets = async () => {
    setLoading(true);
    try {
      const filters: string[] = [];
      if (query) {
        filters.push(query);
      }
      if (filterTag) {
        filters.push(`tag==${filterTag}`);
      }
      const response = await managementApi.listTargets({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort: `${sortField}:${sortOrder.toUpperCase()}`,
        q: filters.length > 0 ? filters.join(';') : undefined,
      });

      // Fetch installed distribution sets for targets that have them
      const targetsWithDs = await Promise.all(
        response.items.map(async (target) => {
          if (target.installedAt) {
            try {
              const installedDsResponse = await managementApi.getTargetInstalledDistributionSet(
                String(target.controllerId ?? target.id)
              );
              // API returns the DS directly or wrapped in data property
              const installedDs = installedDsResponse?.data || installedDsResponse || null;
              return { ...target, installedDistributionSet: installedDs };
            } catch {
              return target;
            }
          }
          return target;
        })
      );

      setRows(targetsWithDs);
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
  }, [page, pageSize, query, filterTag, sortField, sortOrder]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowKeys.includes(String(row.controllerId))), [rows, selectedRowKeys]);

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
      // Map UI field names to API field names
      const fieldMapping: Record<string, string> = {
        'status': null, // Status doesn't support API sorting
        'updateStatus': 'updateStatus',
        'controllerId': 'controllerId',
        'name': 'name',
        'targetTypeName': 'targetTypeName',
        'installedDistributionSet': null, // Distribution Set doesn't support API sorting
        'installedDistributionSetVersion': null, // Version doesn't support API sorting
        'lastModifiedAt': 'lastModifiedAt',
      };
      const apiField = fieldMapping[sorter.field];
      if (apiField) {
        setSortField(apiField);
        setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
      }
    } else if (!sorter?.order) {
      // If order is undefined, reset to default
      setSortField('lastModifiedAt');
      setSortOrder('desc');
    }
  };

  const getPollStatus = (target: HawkbitEntity) => {
    const pollStatus = target.pollStatus as { lastRequestAt?: number; overdue?: boolean } | null;
    if (!pollStatus?.lastRequestAt) {
      return {
        icon: <StopOutlined style={{ color: '#8c8c8c' }} />,
        text: 'No Poll Status',
        color: 'default',
        detail: 'Never polled',
      };
    }

    const lastPoll = dayjs(pollStatus.lastRequestAt);
    const now = dayjs();
    const diffMs = now.diff(lastPoll);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor(diffMs / (1000));

    let timeText: string;
    if (diffDays > 0) {
      timeText = `${diffDays}d`;
    } else if (diffHours > 0) {
      timeText = `${diffHours}h`;
    } else if (diffMinutes > 0) {
      timeText = `${diffMinutes}m`;
    } else {
      timeText = `${diffSeconds}s`;
    }

    if (pollStatus.overdue) {
      return {
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: `Overdue ${timeText}`,
        color: 'error',
        detail: `Last poll: ${lastPoll.format('YYYY-MM-DD HH:mm:ss')} (Overdue)`,
      };
    }

    return {
      icon: <ClockCircleOutlined style={{ color: '#52c41a' }} />,
      text: `In Time ${timeText}`,
      color: 'success',
      detail: `Last poll: ${lastPoll.format('YYYY-MM-DD HH:mm:ss')}`,
    };
  };

  const getSyncStatus = (target: HawkbitEntity) => {
    const updateStatus = target.updateStatus?.toLowerCase() || '';
    if (updateStatus === 'in_sync') {
      return {
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        text: t('targets.syncInSync'),
        color: 'success',
      };
    } else if (updateStatus === 'registered') {
      return {
        icon: <CheckCircleOutlined style={{ color: '#1890ff' }} />,
        text: t('targets.syncRegistered'),
        color: 'processing',
      };
    } else if (updateStatus === 'pending') {
      return {
        icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
        text: t('targets.syncPending'),
        color: 'warning',
      };
    } else if (updateStatus === 'error') {
      return {
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: t('targets.syncError'),
        color: 'error',
      };
    }
    return {
      icon: <QuestionCircleOutlined style={{ color: '#d9d9d9' }} />,
      text: t('targets.syncUnknown'),
      color: 'default',
    };
  };

  const columns: ColumnsType<HawkbitEntity> = [
    {
      title: t('table.status'),
      dataIndex: 'pollStatus',
      sorter: false,
      render: (_, record) => {
        const status = getPollStatus(record);
        return <Tooltip title={status.detail}><Tag color={status.color}>{status.icon} {status.text}</Tag></Tooltip>;
      },
    },
    {
      title: t('targets.syncStatus'),
      dataIndex: 'updateStatus',
      sorter: true,
      sortOrder: sortField === 'updateStatus' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (_, record) => {
        const status = getSyncStatus(record);
        return <Tooltip title={status.text}><Tag color={status.color}>{status.icon}</Tag></Tooltip>;
      },
    },
    {
      title: t('table.controllerId'),
      dataIndex: 'controllerId',
      sorter: true,
      sortOrder: sortField === 'controllerId' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.type'),
      dataIndex: 'targetTypeName',
      sorter: true,
      sortOrder: sortField === 'targetTypeName' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (_, record) => record.targetTypeName || '-',
    },
    {
      title: t('table.distributionSet'),
      dataIndex: 'installedDistributionSet',
      sorter: false,
      render: (_, record) => {
        const installedDs = record.installedDistributionSet;
        if (!installedDs) return '-';
        return installedDs.name || '-';
      },
    },
    {
      title: t('table.version'),
      dataIndex: 'installedDistributionSetVersion',
      sorter: false,
      render: (_, record) => {
        const installedDs = record.installedDistributionSet;
        return installedDs?.version || '-';
      },
    },
    {
      title: t('table.lastModifiedAt'),
      dataIndex: 'lastModifiedAt',
      sorter: true,
      sortOrder: sortField === 'lastModifiedAt' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: number) => formatDateTime(value),
    },
    {
      title: t('common.actions'),
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.details')}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailsTarget(record);
                setDetailsOpen(true);
              }}
            />
          </Tooltip>
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
          <Select
            allowClear
            placeholder="Filter by Tag"
            style={{ width: 200 }}
            options={tags.map((tag) => ({ value: String(tag.name), label: String(tag.name) }))}
            onChange={(value) => {
              setFilterTag(value);
              setPage(1);
            }}
            value={filterTag}
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
              icon={<UserOutlined />}
              disabled={selectedRows.length !== 1}
              onClick={() => {
                setAssignDsTarget(selectedRows[0]);
                assignDsForm.resetFields();
                setAssignDsOpen(true);
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
                    setSelectedRowKeys([]);
                    await loadTargets();
                  },
                });
              }}
            />
          </Tooltip>
        </Space>

        <Table<HawkbitEntity>
          rowKey={(row) => String(row.controllerId)}
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as Array<string | number>),
          }}
          scroll={{ x: 1200 }}
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

      {detailsTarget && (
        <TargetDetailsModal
          target={detailsTarget}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onUpdate={() => void loadTargets()}
        />
      )}

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
        title={t('targets.assignDs')}
        open={assignDsOpen}
        onCancel={() => setAssignDsOpen(false)}
        onOk={() => {
          void assignDsForm.validateFields().then(async (values) => {
            if (!assignDsTarget) return;
            try {
              await managementApi.assignDistributionSet(
                String(assignDsTarget.controllerId ?? assignDsTarget.id),
                Number(values.distributionSetId),
                values.actionType || 'forced',
                values.actionType === 'timeforced'
                  ? values.forcetime
                    ? dayjs(values.forcetime).valueOf()
                    : Date.now()
                  : undefined
              );
              notification.success({ message: t('common.updated') });
              setAssignDsOpen(false);
              await loadTargets();
            } catch (error) {
              notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
            }
          });
        }}
      >
        <Form layout="vertical" form={assignDsForm} initialValues={{ actionType: 'forced' }}>
          <Form.Item name="distributionSetId" label={t('table.distributionSet')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('targets.distributionSetId')}
              options={distributionSets.map((item) => ({
                value: String(item.id),
                label: `${item.name}:${item.version}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="actionType" label={t('targets.actionType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'forced', label: 'Forced' },
                { value: 'soft', label: 'Soft' },
                { value: 'downloadonly', label: 'Download Only' },
                { value: 'timeforced', label: 'Time Forced' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.actionType !== curr.actionType}>
            {({ getFieldValue }) =>
              getFieldValue('actionType') === 'timeforced' ? (
                <Form.Item name="forcetime" label={t('rollouts.forceTime')}>
                  <Input type="datetime-local" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

interface TargetDetailsModalProps {
  target: HawkbitEntity;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const TargetDetailsModal = ({ target, open, onClose, onUpdate }: TargetDetailsModalProps) => {
  const { t } = useTranslation();
  const controllerId = String(target.controllerId ?? target.id ?? '');

  return (
    <Modal
      title={`${t('common.details')} #${controllerId}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose
    >
      <Tabs
        defaultActiveKey="details"
        items={[
          {
            key: 'details',
            label: t('common.details'),
            children: <DetailsTab target={target} />,
          },
          {
            key: 'assigned',
            label: `${t('table.assignedDs')} / ${t('targets.installedDs')}`,
            children: <AssignedInstalledTab target={target} />,
          },
          {
            key: 'tags',
            label: <Tag>Tags</Tag>,
            children: <TagsTab target={target} onUpdate={onUpdate} />,
          },
          {
            key: 'metadata',
            label: t('targets.metadata'),
            children: <MetadataTab target={target} />,
          },
          {
            key: 'actions',
            label: (
              <Space size={4}>
                <HistoryOutlined />
                <span>{t('targets.actionHistory')}</span>
              </Space>
            ),
            children: <ActionsHistoryTab target={target} />,
          },
        ]}
      />
    </Modal>
  );
};

const DetailsTab = ({ target }: { target: HawkbitEntity }) => {
  const { t } = useTranslation();
  const [attributes, setAttributes] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const pollStatus = target.pollStatus as { lastRequestAt?: number; overdue?: boolean } | null;

  useEffect(() => {
    const loadAttributes = async () => {
      setLoading(true);
      try {
        const response = await managementApi.getTargetAttributes(String(target.controllerId ?? target.id ?? ''));
        setAttributes(response.data || {});
      } catch {
        setAttributes({});
      } finally {
        setLoading(false);
      }
    };
    void loadAttributes();
  }, [target]);

  const formatAttributes = () => {
    if (!attributes) return '-';
    if (Object.keys(attributes).length === 0) return t('common.value');
    return Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  const getPollStatusDetail = () => {
    if (!pollStatus?.lastRequestAt) {
      return 'No Poll Status';
    }
    const lastPoll = dayjs(pollStatus.lastRequestAt);
    const now = dayjs();
    const diffMs = now.diff(lastPoll);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    let timeText: string;
    if (diffDays > 0) {
      timeText = `${diffDays}d`;
    } else if (diffHours > 0) {
      timeText = `${diffHours}h`;
    } else {
      timeText = `${diffMinutes}m`;
    }

    if (pollStatus.overdue) {
      return `Overdue ${timeText} (Last: ${lastPoll.format('YYYY-MM-DD HH:mm:ss')})`;
    }
    return `${timeText} ago (Last: ${lastPoll.format('YYYY-MM-DD HH:mm:ss')})`;
  };

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label={t('common.description')} span={2}>
        {target.description || '-'}
      </Descriptions.Item>
      <Descriptions.Item label={t('rollouts.createdBy')}>{target.createdBy || '-'}</Descriptions.Item>
      <Descriptions.Item label={t('table.createdAt')}>{formatDateTime(target.createdAt)}</Descriptions.Item>
      <Descriptions.Item label={t('rollouts.lastModifiedBy')}>{target.lastModifiedBy || '-'}</Descriptions.Item>
      <Descriptions.Item label={t('table.lastModifiedAt')}>{formatDateTime(target.lastModifiedAt)}</Descriptions.Item>
      <Descriptions.Item label="Security Token">{target.securityToken || '-'}</Descriptions.Item>
      <Descriptions.Item label="Last Poll">{getPollStatusDetail()}</Descriptions.Item>
      <Descriptions.Item label={t('targetGroups.groupName')}>{target.group || '-'}</Descriptions.Item>
      <Descriptions.Item label="Address">{target.address || '-'}</Descriptions.Item>
      <Descriptions.Item label="Attributes" span={2}>
        <Input.TextArea value={formatAttributes()} rows={6} readOnly loading={loading} />
      </Descriptions.Item>
    </Descriptions>
  );
};

const AssignedInstalledTab = ({ target }: { target: HawkbitEntity }) => {
  const { t } = useTranslation();
  const [assignedDs, setAssignedDs] = useState<HawkbitEntity | null>(null);
  const [installedDs, setInstalledDs] = useState<HawkbitEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{assigned?: string; installed?: string}>({});
  const controllerId = String(target.controllerId ?? target.id ?? '');

  const loadData = async () => {
    setLoading(true);
    setError({});
    try {
      const [assigned, installed] = await Promise.all([
        managementApi.getTargetAssignedDistributionSet(controllerId)
          .then(res => ({ data: res.data || res, error: null }))
          .catch(err => ({ data: null, error: toErrorMessage(err) })),
        managementApi.getTargetInstalledDistributionSet(controllerId)
          .then(res => ({ data: res.data || res, error: null }))
          .catch(err => ({ data: null, error: toErrorMessage(err) })),
      ]);
      setAssignedDs(assigned.data);
      setInstalledDs(installed.data);
      setError({ assigned: assigned.error, installed: installed.error });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [controllerId]);

  const renderDs = (ds: HawkbitEntity | null, label: string, errorMsg?: string) => {
    if (loading) return <Card loading title={label} />;
    if (errorMsg) return <Card title={label}><span style={{ color: '#ff4d4f' }}>{errorMsg}</span></Card>;
    if (!ds || !ds.name) return <Card title={label}>{t('common.value')}</Card>;

    const modules = (ds.modules as Array<{ typeName: string; version: string }>) || [];

    return (
      <Card
        title={
          <Space>
            <span>{label}</span>
            <Tag color="blue">
              {ds.name}: {ds.version}
            </Tag>
          </Space>
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Name">{ds.name}</Descriptions.Item>
          <Descriptions.Item label="Version">{ds.version}</Descriptions.Item>
          <Descriptions.Item label="Modules">
            {modules.length === 0 ? '-' : modules.map((m, i) => <div key={i}>{m.typeName}: {m.version}</div>)}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {renderDs(assignedDs, t('table.assignedDs'), error.assigned)}
      {renderDs(installedDs, t('targets.installedDs'), error.installed)}
    </Space>
  );
};

 const TagsTab = ({ target, onUpdate }: { target: HawkbitEntity; onUpdate: () => void }) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<HawkbitEntity[]>([]);
  const [availableTags, setAvailableTags] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1890ff');
  const controllerId = String(target.controllerId ?? target.id ?? '');

  const loadTags = async () => {
    setLoading(true);
    try {
      const [assignedTags, allTags] = await Promise.all([
        managementApi.getTargetTags(controllerId),
        managementApi.listTargetTags(),
      ]);
      setTags(assignedTags.data || []);
      setAvailableTags(allTags || []);
    } catch {
      setTags([]);
      setAvailableTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTags();
  }, [controllerId]);

  const handleAssignTag = async (tagId: number) => {
    try {
      await managementApi.assignTargetTag(tagId, controllerId);
      void loadTags();
      onUpdate();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleUnassignTag = async (tagId: number) => {
    try {
      await managementApi.unassignTargetTag(tagId, controllerId);
      void loadTags();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await managementApi.createTargetTag({ name: newTagName, description: newTagDescription, colour: newTagColor });
      setNewTagName('');
      setNewTagDescription('');
      setNewTagColor('#1890ff');
      setCreatingTag(false);
      void loadTags();
      notification.success({ message: t('common.created') });
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Select
          showSearch
          style={{ width: 250 }}
          placeholder="Select tag to assign"
          loading={loading}
          value={null}
          onChange={(value) => value && handleAssignTag(Number(value))}
          options={availableTags
            .filter((tag) => !tags.some((assigned) => assigned.id === tag.id))
            .map((tag) => ({
              value: String(tag.id),
              label: tag.name,
            }))}
        />
        <Button icon={<PlusOutlined />} onClick={() => setCreatingTag(true)}>
          Create Tag
        </Button>
      </Space>
      <Space wrap>
        {tags.map((tag) => (
          <Tag
            key={tag.id}
            color={tag.colour}
            closable
            onClose={(e) => {
              e.preventDefault();
              void handleUnassignTag(tag.id as number);
            }}
          >
            {tag.name}
          </Tag>
        ))}
      </Space>

      <Modal
        title="Create Tag"
        open={creatingTag}
        onCancel={() => setCreatingTag(false)}
        onOk={handleCreateTag}
      >
        <Form layout="vertical">
          <Form.Item label="Name" required>
            <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" />
          </Form.Item>
          <Form.Item label="Description">
            <Input.TextArea
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              placeholder="Tag description"
            />
          </Form.Item>
          <Form.Item label="Color">
            <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

const MetadataTab = ({ target }: { target: HawkbitEntity }) => {
  const { t } = useTranslation();
  const [metadata, setMetadata] = useState<Array<{ key: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const controllerId = String(target.controllerId ?? target.id ?? '');

  const loadMetadata = async () => {
    setLoading(true);
    try {
      const response = await managementApi.getTargetMetadata(controllerId);
      setMetadata(response.data?.content || []);
    } catch {
      setMetadata([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetadata();
  }, [controllerId]);

  const handleAddMetadata = async (key: string, value: string) => {
    try {
      await managementApi.createTargetMetadata(controllerId, key, value);
      void loadMetadata();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleDeleteMetadata = async (key: string) => {
    try {
      await managementApi.deleteTargetMetadata(controllerId, key);
      setMetadata((current) => current.filter((m) => m.key !== key));
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const columns: ColumnsType<{ key: string; value: string }> = [
    { title: t('targets.metadataKey'), dataIndex: 'key' },
    { title: t('targets.metadataValue'), dataIndex: 'value' },
    {
      title: t('common.actions'),
      render: (_, row) => (
        <Button danger size="small" onClick={() => void handleDeleteMetadata(row.key)}>
          {t('common.delete')}
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {loading ? (
        <Table loading />
      ) : (
        <>
          <Table<{ key: string; value: string }>
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={metadata}
            pagination={false}
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
                    <Input
                      placeholder={t('targets.metadataValue')}
                      onChange={(event) => (value = event.target.value)}
                    />
                  </Space>
                ),
                onOk: async () => {
                  if (!key.trim()) return;
                  await handleAddMetadata(key.trim(), value);
                },
              });
            }}
          >
            {t('targets.addMetadata')}
          </Button>
        </>
      )}
    </Space>
  );
};

const ActionsHistoryTab = ({ target }: { target: HawkbitEntity }) => {
  const { t } = useTranslation();
  const controllerId = String(target.controllerId ?? target.id ?? '');
  const [actions, setActions] = useState<ActionListEntry[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionListEntry | null>(null);
  const [actionStatuses, setActionStatuses] = useState<ActionStatusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadActions = async () => {
    setLoading(true);
    try {
      const response = await managementApi.getTargetActions(controllerId);
      // API returns PagedList with content array
      const actionList = (response.data?.content || response.data || []) as Array<{
        id: number;
        type: string;
        active: boolean;
        status: string;
        forceType?: string;
        lastModifiedAt: number;
        createdAt: number;
        weight?: number;
        rollout?: number;
        rolloutName?: string;
        distributionSet?: { id: number; name: string; version: string };
        _links?: Record<string, { href: string }>;
      }>;

      const enrichedActions = await Promise.all(
        actionList.map(async (action) => {
          let distributionSet: ActionListEntry['distributionSet'] = undefined;
          let forceType = action.forceType;

          // Fetch full action details to get distribution set link
          try {
            const fullActionResponse = await managementApi.getTargetAction(controllerId, action.id);
            const fullAction = fullActionResponse.data || fullActionResponse;

            // Get forceType from full action if not available
            if (!forceType && fullAction.forceType) {
              forceType = fullAction.forceType;
            }

            // Get distribution set from _links
            const links = fullAction._links || fullAction.links || {};
            const dsLink = links['distributionset'] || links['distributionSet'];
            if (dsLink?.href) {
              const dsId = dsLink.href.substring(dsLink.href.lastIndexOf('/') + 1);
              const dsData = await managementApi.getDistributionSet(dsId);
              distributionSet = {
                id: dsData.id,
                name: dsData.name,
                version: dsData.version,
              };
            }
          } catch {
            // If individual action fetch fails, try from list response
            if (action.distributionSet && action.distributionSet.name) {
              distributionSet = {
                id: action.distributionSet.id,
                name: action.distributionSet.name,
                version: action.distributionSet.version,
              };
            }
          }

          return {
            id: action.id,
            type: action.type,
            active: action.active,
            status: action.status,
            forceType,
            lastModifiedAt: action.lastModifiedAt,
            createdAt: action.createdAt,
            weight: action.weight,
            rollout: action.rollout,
            rolloutName: action.rolloutName,
            distributionSet,
          } as ActionListEntry;
        })
      );

      setActions(enrichedActions);
      if (enrichedActions.length > 0) {
        setSelectedAction(enrichedActions[0]);
      }
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActions();
  }, [controllerId]);

  useEffect(() => {
    if (selectedAction) {
      setStatusLoading(true);
      managementApi
        .getTargetActionStatusList(controllerId, selectedAction.id)
        .then((response) => {
          setActionStatuses(response.data?.content || []);
        })
        .catch(() => setActionStatuses([]))
        .finally(() => setStatusLoading(false));
    } else {
      setActionStatuses([]);
    }
  }, [selectedAction, controllerId]);

  const handleCancelAction = async (force = false) => {
    if (!selectedAction) return;
    try {
      await managementApi.cancelTargetAction(controllerId, selectedAction.id, force);
      notification.success({ message: t('common.updated') });
      void loadActions();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleForceAction = async () => {
    if (!selectedAction) return;
    try {
      await managementApi.updateTargetAction(controllerId, selectedAction.id, 'forced');
      notification.success({ message: t('common.updated') });
      void loadActions();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'finished':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'scheduled':
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'running':
      case 'retrieved':
      case 'download':
        return <ClockCircleOutlined style={{ color: '#73d13d' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'canceled':
        return <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;
      case 'canceling':
        return <CloseCircleOutlined style={{ color: '#8c8c8c' }} />;
      default:
        return <QuestionCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getForceTypeIcon = (forceType?: string) => {
    switch (forceType?.toUpperCase()) {
      case 'FORCED':
        return <Tooltip title="Forced"><ThunderboltOutlined style={{ color: '#faad14' }} /></Tooltip>;
      case 'TIMEFORCED':
        return <Tooltip title="Time Forced"><ClockCircleOutlined style={{ color: '#722ed1' }} /></Tooltip>;
      case 'SOFT':
        return <Tooltip title="Soft"><UserOutlined style={{ color: '#52c41a' }} /></Tooltip>;
      case 'DOWNLOAD_ONLY':
        return <Tooltip title="Download Only"><DownloadOutlined style={{ color: '#13c2c2' }} /></Tooltip>;
      default:
        return <Tooltip title="Unknown">-</Tooltip>;
    }
  };

  const actionColumns: ColumnsType<ActionListEntry> = [
    {
      title: 'Status',
      dataIndex: 'status',
      width: 80,
      render: (status: string) => getStatusIcon(status),
    },
    {
      title: 'Distribution Set',
      dataIndex: 'distributionSet',
      render: (ds) => (ds ? `${ds.name}:${ds.version}` : '-'),
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModifiedAt',
      width: 150,
      render: formatDateTime,
    },
    {
      title: 'Type',
      dataIndex: 'forceType',
      width: 100,
      render: (forceType) => getForceTypeIcon(forceType),
    },
    {
      title: 'Actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {record.active && record.type === 'update' && (
            <Tooltip title="Cancel Action">
              <Button
                size="small"
                icon={<StopOutlined />}
                disabled={!selectedAction || selectedAction.id !== record.id}
                onClick={() => {
                  Modal.confirm({
                    title: 'Cancel Action',
                    content: 'Are you sure you want to cancel this action?',
                    onOk: () => void handleCancelAction(false),
                  });
                }}
              />
            </Tooltip>
          )}
          {record.active && record.type === 'update' && record.forceType?.toUpperCase() !== 'FORCED' && (
            <Tooltip title="Force Action">
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                disabled={!selectedAction || selectedAction.id !== record.id}
                onClick={() => {
                  Modal.confirm({
                    title: 'Force Action',
                    content: 'Are you sure you want to force this action?',
                    onOk: handleForceAction,
                  });
                }}
              />
            </Tooltip>
          )}
          {record.active && record.type === 'cancel' && (
            <Tooltip title="Force Cancel">
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                disabled={!selectedAction || selectedAction.id !== record.id}
                onClick={() => {
                  Modal.confirm({
                    title: 'Force Cancel',
                    content: 'Are you sure you want to force cancel this action?',
                    onOk: () => void handleCancelAction(true),
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
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Table<ActionListEntry>
        rowKey="id"
        size="small"
        loading={loading}
        columns={actionColumns}
        dataSource={actions}
        pagination={false}
        onRow={(record) => ({
          onClick: () => setSelectedAction(record),
          style: selectedAction?.id === record.id ? { backgroundColor: '#e6f7ff' } : {},
        })}
      />
      {selectedAction && (
        <Card
          title={
            <Space>
              <span>Action Details</span>
              <Tag>#{selectedAction.id}</Tag>
            </Space>
          }
          size="small"
        >
          <Table<ActionStatusEntry>
            rowKey="id"
            size="small"
            loading={statusLoading}
            columns={[
              {
                title: 'Status',
                width: 80,
                render: (_, record) => getStatusIcon(record.type),
              },
              {
                title: 'Time',
                width: 150,
                dataIndex: 'reportedAt',
                render: formatDateTime,
              },
              {
                title: 'Message',
                render: (_, record) => (
                  <Space direction="vertical" size="small">
                    {record.messages?.map((msg, i) => <div key={i}>{msg}</div>)}
                  </Space>
                ),
              },
            ]}
            dataSource={actionStatuses}
            pagination={false}
          />
        </Card>
      )}
    </Space>
  );
};