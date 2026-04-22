import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
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
  DeleteOutlined,
  FileSearchOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

interface RolloutStatus {
  label: string;
  color: string;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
}

export const RolloutsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [targetFilters, setTargetFilters] = useState<HawkbitEntity[]>([]);
  const [distributionSets, setDistributionSets] = useState<HawkbitEntity[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<HawkbitEntity | null>(null);
  const [filterName, setFilterName] = useState('');
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  const ROLLOUT_STATUS_STOPPABLE = ['creating', 'ready', 'waiting_for_approval', 'starting', 'running', 'paused', 'approval_denied'];

  const formatDateTime = (value: number) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
  };

  const getActionTypeLabel = (actionType: string) => {
    const typeMap: Record<string, string> = {
      FORCED: 'Forced',
      SOFT: 'Soft',
      DOWNLOAD_ONLY: 'Download Only',
      TIMEFORCED: 'Time Forced',
    };
    return typeMap[actionType] || actionType;
  };

  const getStatusInfo = (status: string): RolloutStatus => {
    const upper = (status || '').toUpperCase();
    return {
      label: upper,
      color: {
        READY: 'blue',
        RUNNING: 'green',
        PAUSED: 'orange',
        FINISHED: 'purple',
        ERROR: 'red',
        CANCELLING: 'orange',
      }[upper] || 'default',
      canStart: upper === 'READY',
      canPause: upper === 'RUNNING',
      canResume: upper === 'PAUSED',
      canStop: ROLLOUT_STATUS_STOPPABLE.includes(status?.toLowerCase()),
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: string[] = [];
      if (filterName) {
        filters.push(`name=rl=.*${filterName}.*`);
      }

      const [rollouts, filtersResponse, ds] = await Promise.all([
        managementApi.listRollouts({
          offset: (page - 1) * pageSize,
          limit: pageSize,
          sort: `${sortField}:${sortOrder}`,
          q: filters.length > 0 ? filters.join(';') : undefined,
        }),
        managementApi.listTargetFilters({ offset: 0, limit: 200, sort: 'name:asc' }),
        managementApi.listDistributionSets({ offset: 0, limit: 200, sort: 'name:asc' }),
      ]);

      setRows(rollouts.items);
      setTotal(rollouts.total);
      setTargetFilters(filtersResponse.items);
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
  }, [page, pageSize, filterName, sortOrder, sortField]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedRowKeys.includes(String(row.id))), [rows, selectedRowKeys]);

  const showDetails = (record: HawkbitEntity) => {
    setDetailsItem(record);
    setDetailsOpen(true);
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
      width: 100,
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortField === 'name' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortField === 'status' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (value: string) => {
        const info = getStatusInfo(value);
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: t('rollouts.states'),
      dataIndex: 'totalTargetsPerStatus',
      render: (value: Record<string, number>) => {
        if (!value || typeof value !== 'object') return '-';
        const statusColors: Record<string, string> = {
          NOT_STARTED: 'default',
          SCHEDULED: 'blue',
          RUNNING: 'processing',
          FINISHED: 'green',
          ERROR: 'red',
          CANCELLED: 'orange',
        };
        return (
          <Space size="small" wrap>
            {Object.entries(value).map(([status, count]) => (
              <Tag key={status} color={statusColors[status] || 'default'}>
                {status}: {count}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: t('rollouts.groups'),
      dataIndex: 'totalGroups',
      sorter: true,
      sortOrder: sortField === 'totalGroups' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      width: 100,
    },
    {
      title: t('rollouts.targets'),
      dataIndex: 'totalTargets',
      sorter: true,
      sortOrder: sortField === 'totalTargets' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      width: 100,
    },
    {
      title: t('common.actions'),
      render: (_, record) => {
        const info = getStatusInfo(record.status as string);
        return (
          <Space>
            <Tooltip title={t('common.details')}>
              <Button size="small" icon={<FileSearchOutlined />} onClick={() => showDetails(record)} />
            </Tooltip>
            {info.canStart && (
              <Tooltip title={t('rollouts.actions.start')}>
                <Button
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={async () => {
                    try {
                      await managementApi.rolloutAction(String(record.id), 'start');
                      notification.success({ message: t('common.updated') });
                      await loadData();
                    } catch (error) {
                      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                    }
                  }}
                />
              </Tooltip>
            )}
            {info.canPause && (
              <Tooltip title={t('rollouts.actions.pause')}>
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={async () => {
                    try {
                      await managementApi.rolloutAction(String(record.id), 'pause');
                      notification.success({ message: t('common.updated') });
                      await loadData();
                    } catch (error) {
                      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                    }
                  }}
                />
              </Tooltip>
            )}
            {info.canResume && (
              <Tooltip title={t('rollouts.actions.resume')}>
                <Button
                  size="small"
                  icon={<SyncOutlined />}
                  onClick={async () => {
                    try {
                      await managementApi.rolloutAction(String(record.id), 'resume');
                      notification.success({ message: t('common.updated') });
                      await loadData();
                    } catch (error) {
                      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                    }
                  }}
                />
              </Tooltip>
            )}
            {info.canStop && (
              <Tooltip title={t('rollouts.actions.stop')}>
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  danger
                  onClick={async () => {
                    Modal.confirm({
                      title: t('common.confirmDelete'),
                      content: t('rollouts.confirmStop'),
                      onOk: async () => {
                        try {
                          await managementApi.rolloutAction(String(record.id), 'stop');
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
            <Tooltip title={t('common.delete')}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={async () => {
                  Modal.confirm({
                    title: t('rollouts.confirmDelete'),
                    onOk: async () => {
                      try {
                        await managementApi.deleteRollouts([record.id]);
                        notification.success({ message: t('common.deleted') });
                        await loadData();
                      } catch (error) {
                        notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                      }
                    },
                  });
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title={<Typography.Title level={4}>{t('page.rollouts.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={t('rollouts.filterName')}
            style={{ width: 240 }}
            onSearch={(value) => {
              setFilterName(value.trim());
              setPage(1);
            }}
            defaultValue={filterName}
          />
          <Tooltip title={t('common.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} />
          </Tooltip>
          <Tooltip title={t('common.create')}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setCreateOpen(true);
              }}
            />
          </Tooltip>
        </Space>

        <Table<HawkbitEntity>
          rowKey={(row) => String(row.id)}
          loading={loading}
          columns={columns}
          dataSource={rows}
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
        title={t('rollouts.createTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          void form.validateFields().then(async (values) => {
            try {
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
              };

              if (values.startType === 'auto') {
                payload.startAt = Date.now();
              } else if (values.startType === 'scheduled' && values.startAt) {
                payload.startAt = dayjs(values.startAt).valueOf();
              }

              if (values.actionType === 'TIMEFORCED' && values.forcetime) {
                // Handle forcetime specially
                payload['forcetime'] = dayjs(values.forcetime).valueOf();
              }

              await managementApi.createRollout(payload);
              notification.success({ message: t('common.created') });
              setCreateOpen(false);
              await loadData();
            } catch (error) {
              notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
            }
          });
        }}
        width={700}
      >
        <Form layout="vertical" form={form} initialValues={{
          actionType: 'FORCED',
          amountGroups: 1,
          successThreshold: 100,
          errorThreshold: 10,
          startType: 'manual',
          dynamic: false,
        }}>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="distributionSetId" label={t('table.distributionSet')} rules={[{ required: true }]}>
            <Select
              showSearch
              options={distributionSets.map((item) => ({
                value: String(item.id),
                label: `${String(item.name ?? item.id)}:${String(item.version ?? '')}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="targetFilterId" label={t('rollouts.targetFilter')} rules={[{ required: true }]}>
            <Select
              showSearch
              options={targetFilters.map((item) => ({ value: String(item.id), label: String(item.name ?? item.id) }))}
            />
          </Form.Item>
          <Form.Item name="actionType" label={t('rollouts.actionType')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'FORCED', label: 'Forced' },
              { value: 'SOFT', label: 'Soft' },
              { value: 'DOWNLOAD_ONLY', label: 'Download Only' },
              { value: 'TIMEFORCED', label: 'Time Forced' },
            ]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.actionType !== curr.actionType}>
            {({ getFieldValue }) =>
              getFieldValue('actionType') === 'TIMEFORCED' ? (
                <Form.Item name="forcetime" label={t('rollouts.forceTime')}>
                  <Input type="datetime-local" />
                </Form.Item>
              ) : null
            }
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
          <Form.Item name="startType" label={t('rollouts.startType')}>
            <Select
              options={[
                { value: 'manual', label: t('rollouts.manual') },
                { value: 'auto', label: t('rollouts.auto') },
                { value: 'scheduled', label: t('rollouts.scheduled') },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.startType !== curr.startType}>
            {({ getFieldValue }) =>
              getFieldValue('startType') === 'scheduled' ? (
                <Form.Item name="startAt" label={t('rollouts.startAt')}>
                  <Input type="datetime-local" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="dynamic" label={t('rollouts.dynamic')} valuePropName="checked">
            <Checkbox />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('rollouts.details')}
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={null}
        width={800}
      >
        {detailsItem && (() => {
          const distributionSet = distributionSets.find((ds) => String(ds.id) === String(detailsItem.distributionSetId));
          const targetFilter = targetFilters.find((tf) => String(tf.id) === String(detailsItem.targetFilterQuery));
          return (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t('table.id')}>{detailsItem.id}</Descriptions.Item>
              <Descriptions.Item label={t('table.name')}>{detailsItem.name}</Descriptions.Item>
              <Descriptions.Item label={t('table.status')}>
                <Tag color={getStatusInfo(detailsItem.status as string).color}>
                  {getStatusInfo(detailsItem.status as string).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.groups')}>{detailsItem.totalGroups}</Descriptions.Item>
              <Descriptions.Item label={t('rollouts.targets')}>{detailsItem.totalTargets}</Descriptions.Item>
              <Descriptions.Item label={t('rollouts.actionType')}>
                {getActionTypeLabel(detailsItem.actionType as string)}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.description')} span={2}>
                {detailsItem.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('table.distributionSet')}>
                {distributionSet ? `${distributionSet.name ?? distributionSet.id}:${distributionSet.version ?? ''}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.targetFilter')}>
                {targetFilter?.name || detailsItem.targetFilterQuery || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.createdBy')}>{detailsItem.createdBy || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('table.createdAt')}>
                {formatDateTime(detailsItem.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.lastModifiedBy')}>{detailsItem.lastModifiedBy || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('table.lastModifiedAt')}>
                {formatDateTime(detailsItem.lastModifiedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('rollouts.startAt')}>
                {formatDateTime(detailsItem.startAt)}
              </Descriptions.Item>
            </Descriptions>
          );
        })()}
      </Modal>
    </Card>
  );
};