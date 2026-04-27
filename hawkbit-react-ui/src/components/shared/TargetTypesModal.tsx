import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../../api/managementApi';
import type { HawkbitEntity } from '../../types/api';
import { toErrorMessage } from '../../utils/normalize';

interface TargetTypesModalProps {
  open: boolean;
  onClose: () => void;
}

export const TargetTypesModal = ({ open, onClose }: TargetTypesModalProps) => {
  const { t } = useTranslation();
  const [targetTypes, setTargetTypes] = useState<HawkbitEntity[]>([]);
  const [distributionSetTypes, setDistributionSetTypes] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingType, setEditingType] = useState<HawkbitEntity | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [compatibleDsTypes, setCompatibleDsTypes] = useState<HawkbitEntity[]>([]);
  const [compatibleModalOpen, setCompatibleModalOpen] = useState(false);
  const [selectedTargetType, setSelectedTargetType] = useState<HawkbitEntity | null>(null);
  const [form] = Form.useForm();

  const loadTargetTypes = useCallback(async () => {
    setLoading(true);
    try {
      const [types, dsTypes] = await Promise.all([
        managementApi.listTargetTypes(),
        managementApi.listDistributionSetTypes(),
      ]);
      setTargetTypes(types);
      setDistributionSetTypes(dsTypes);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      void loadTargetTypes();
    }
  }, [open, loadTargetTypes]);

  const handleCreate = () => {
    setEditingType(null);
    form.resetFields();
    setEditModalOpen(true);
  };

  const handleEdit = (record: HawkbitEntity) => {
    setEditingType(record);
    form.setFieldsValue({
      name: record.name,
      key: record.key,
      description: record.description,
      colour: record.colour || '#1890ff',
    });
    setEditModalOpen(true);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await managementApi.deleteTargetType(id);
      notification.success({ message: t('common.deleted') });
      await loadTargetTypes();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        key: values.key || values.name.toLowerCase().replace(/\s+/g, '_'),
        description: values.description,
        colour: values.colour || '#1890ff',
      };

      if (editingType) {
        await managementApi.updateTargetType(editingType.id as number, payload);
        notification.success({ message: t('common.updated') });
      } else {
        await managementApi.createTargetType(payload);
        notification.success({ message: t('common.created') });
      }
      setEditModalOpen(false);
      await loadTargetTypes();
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleManageCompatible = async (record: HawkbitEntity) => {
    setSelectedTargetType(record);
    try {
      const compatible = await managementApi.getCompatibleDistributionSetTypes(record.id as number);
      setCompatibleDsTypes(compatible);
      setCompatibleModalOpen(true);
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleAddCompatible = async (dsTypeId: number) => {
    if (!selectedTargetType) return;
    try {
      await managementApi.addCompatibleDistributionSetTypes(selectedTargetType.id as number, [dsTypeId]);
      const compatible = await managementApi.getCompatibleDistributionSetTypes(selectedTargetType.id as number);
      setCompatibleDsTypes(compatible);
      notification.success({ message: t('common.updated') });
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const handleRemoveCompatible = async (dsTypeId: number) => {
    if (!selectedTargetType) return;
    try {
      await managementApi.removeCompatibleDistributionSetType(selectedTargetType.id as number, dsTypeId);
      const compatible = await managementApi.getCompatibleDistributionSetTypes(selectedTargetType.id as number);
      setCompatibleDsTypes(compatible);
      notification.success({ message: t('common.updated') });
    } catch (error) {
      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
    }
  };

  const columns: ColumnsType<HawkbitEntity> = [
    {
      title: t('table.id'),
      dataIndex: 'id',
      width: 80,
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
    },
    {
      title: 'Key',
      dataIndex: 'key',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: t('targets.tagColor'),
      dataIndex: 'colour',
      width: 60,
      render: (colour: string) => <Tag color={colour}>{colour || '-'}</Tag>,
    },
    {
      title: t('common.actions'),
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('common.edit')}>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={t('targetTypes.manageCompatible')}>
            <Button size="small" onClick={() => handleManageCompatible(record)}>
              DS Types
            </Button>
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: t('common.confirmDelete'),
                  onOk: () => handleDelete(record.id as number),
                });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={t('targetTypes.title')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Tooltip title={t('common.refresh')}>
              <Button icon={<SyncOutlined />} onClick={() => void loadTargetTypes()} />
            </Tooltip>
            <Tooltip title={t('common.create')}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} />
            </Tooltip>
          </Space>

          <Table<HawkbitEntity>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={targetTypes}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Space>
      </Modal>

      <Modal
        title={editingType ? t('targetTypes.editTitle') : t('targetTypes.createTitle')}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label={t('table.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="key"
            label="Key"
            rules={[{ required: !editingType }]}
            extra={t('targetTypes.keyHint')}
          >
            <Input disabled={Boolean(editingType)} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="colour" label={t('targets.tagColor')}>
            <Input type="color" style={{ width: 100 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${t('targetTypes.compatibleDsTypes')} - ${selectedTargetType?.name || ''}`}
        open={compatibleModalOpen}
        onCancel={() => setCompatibleModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder={t('targetTypes.addCompatible')}
            optionFilterProp="label"
            onChange={(value) => value && handleAddCompatible(Number(value))}
            value={null}
            options={distributionSetTypes
              .filter((ds) => !compatibleDsTypes.some((c) => c.id === ds.id))
              .map((ds) => ({
                value: String(ds.id),
                label: `${ds.name} (${ds.key})`,
              }))}
          />
          <Table<HawkbitEntity>
            rowKey="id"
            size="small"
            columns={[
              { title: t('table.name'), dataIndex: 'name' },
              { title: 'Key', dataIndex: 'key' },
              {
                title: t('common.actions'),
                width: 80,
                render: (_, record) => (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveCompatible(record.id as number)}
                  />
                ),
              },
            ]}
            dataSource={compatibleDsTypes}
            pagination={false}
          />
        </Space>
      </Modal>
    </>
  );
};
