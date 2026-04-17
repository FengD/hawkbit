import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { managementApi } from '../api/managementApi';
import type { HawkbitEntity } from '../types/api';
import { toErrorMessage } from '../utils/normalize';

export const SoftwareModulesPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HawkbitEntity[]>([]);
  const [types, setTypes] = useState<HawkbitEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HawkbitEntity | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listResponse, typeResponse] = await Promise.all([
        managementApi.listSoftwareModules({ offset: 0, limit: 200, sort: 'name:asc' }),
        managementApi.listSoftwareModuleTypes(),
      ]);
      setRows(listResponse.items);
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
  }, []);

  const selectedRows = rows.filter((row) => selectedRowKeys.includes(String(row.id)));

  const columns: ColumnsType<HawkbitEntity> = [
    { title: t('table.id'), dataIndex: 'id' },
    { title: t('table.name'), dataIndex: 'name' },
    { title: t('table.version'), dataIndex: 'version' },
    { title: t('table.type'), dataIndex: 'typeName' },
    { title: t('table.vendor'), dataIndex: 'vendor' },
    {
      title: t('common.actions'),
      render: (_, record) => (
        <Space>
          <Button
            size="small"
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
          >
            {t('common.edit')}
          </Button>
          <Button
            size="small"
            onClick={async () => {
              try {
                const artifacts = await managementApi.getSoftwareModuleArtifacts(String(record.id));
                Modal.info({
                  width: 900,
                  title: t('softwareModules.artifacts'),
                  content: (
                    <Table<HawkbitEntity>
                      rowKey={(row) => String(row.id)}
                      size="small"
                      pagination={false}
                      dataSource={artifacts}
                      columns={[
                        { title: t('table.id'), dataIndex: 'id' },
                        { title: t('softwareModules.filename'), dataIndex: 'providedFilename' },
                        { title: t('softwareModules.filesize'), dataIndex: 'size' },
                        { title: t('softwareModules.hashes'), dataIndex: 'hashes' },
                      ]}
                    />
                  ),
                });
              } catch (error) {
                notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
              }
            }}
          >
            {t('softwareModules.artifacts')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title={t('page.softwareModules.title')}>
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
          <Upload
            maxCount={1}
            showUploadList
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
            <Button disabled={selectedRows.length !== 1}>{t('common.upload')}</Button>
          </Upload>
          <Button
            danger
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
          <Form.Item name="encrypted" label={t('softwareModules.encrypted')}>
            <Select options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
