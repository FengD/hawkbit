import { Button, Card, Input, Modal, Space, Table, Tag, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

interface GroupItem {
  name: string;
}

const formatDateTime = (value: number) => {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
};

export const TargetGroupsPage = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [targets, setTargets] = useState<HawkbitEntity[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Array<string | number>>([]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await managementApi.listTargetGroups();
      const mapped = response.map((name) => ({ name }));
      setGroups(mapped);
      if (!selectedGroup && mapped.length > 0) {
        setSelectedGroup(mapped[0].name);
      }
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadTargetsForGroup = async (group: string) => {
    if (!group) {
      setTargets([]);
      return;
    }

    setLoadingTargets(true);
    try {
      const response = await managementApi.getGroupAssignedTargets(group, { offset: 0, limit: 200, sort: 'name:asc' }, true);
      setTargets(response.items);
      setSelectedTargetKeys([]);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  useEffect(() => {
    void loadTargetsForGroup(selectedGroup);
  }, [selectedGroup]);

  const groupColumns: ColumnsType<GroupItem> = [
    {
      title: t('targetGroups.groupName'),
      dataIndex: 'name',
      render: (value: string) => <Tag color={value === selectedGroup ? 'purple' : 'default'}>{value}</Tag>,
    },
  ];

  const targetColumns: ColumnsType<HawkbitEntity> = useMemo(
    () => [
      { title: t('table.controllerId'), dataIndex: 'controllerId' },
      { title: t('table.name'), dataIndex: 'name' },
      { title: t('table.status'), dataIndex: 'updateStatus' },
      { title: t('table.createdAt'), dataIndex: 'createdAt', render: (value: number) => formatDateTime(value) },
    ],
    [t],
  );

  return (
    <Card title={<Typography.Title level={4}>{t('page.targetGroups.title')}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Button onClick={() => void loadGroups()}>{t('common.refresh')}</Button>
          <Button
            type="primary"
            onClick={() => {
              let groupName = '';
              let controllerIds = '';
              Modal.confirm({
                title: t('targetGroups.assignTargets'),
                icon: null,
                width: 700,
                content: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input placeholder={t('targetGroups.groupName')} onChange={(event) => (groupName = event.target.value)} />
                    <Input.TextArea
                      rows={6}
                      placeholder={t('targetGroups.controllerIdsHint')}
                      onChange={(event) => (controllerIds = event.target.value)}
                    />
                  </Space>
                ),
                onOk: async () => {
                  const ids = controllerIds
                    .split(/[\n,\s]+/)
                    .map((item) => item.trim())
                    .filter(Boolean);
                  if (!groupName.trim() || ids.length === 0) {
                    return;
                  }

                  await managementApi.assignTargetsToGroup(groupName.trim(), ids);
                  notification.success({ message: t('common.updated') });
                  setSelectedGroup(groupName.trim());
                  await loadGroups();
                  await loadTargetsForGroup(groupName.trim());
                },
              });
            }}
          >
            {t('targetGroups.assignTargets')}
          </Button>
          <Button
            danger
            disabled={selectedTargetKeys.length === 0}
            onClick={() => {
              Modal.confirm({
                title: t('targetGroups.unassignTargets'),
                onOk: async () => {
                  const ids = targets
                    .filter((target) => selectedTargetKeys.includes(String(target.id)))
                    .map((target) => String(target.controllerId ?? target.id));
                  await managementApi.unassignTargetsFromGroup(ids);
                  notification.success({ message: t('common.updated') });
                  await loadTargetsForGroup(selectedGroup);
                },
              });
            }}
          >
            {t('targetGroups.unassignTargets')}
          </Button>
        </Space>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <Table<GroupItem>
            rowKey={(row) => row.name}
            loading={loadingGroups}
            columns={groupColumns}
            dataSource={groups}
            pagination={false}
            size="small"
            onRow={(row) => ({
              onClick: () => setSelectedGroup(row.name),
            })}
          />

          <Table<HawkbitEntity>
            rowKey={(row) => String(row.id)}
            loading={loadingTargets}
            columns={targetColumns}
            dataSource={targets}
            rowSelection={{
              selectedRowKeys: selectedTargetKeys,
              onChange: (keys) => setSelectedTargetKeys(keys as Array<string | number>),
            }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </div>
      </Space>
    </Card>
  );
};
