import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface JsonEditorModalProps {
  open: boolean;
  title: string;
  initialValue?: string;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
}

export const JsonEditorModal = ({ open, title, initialValue, onSubmit, onCancel }: JsonEditorModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ body: initialValue ?? '{\n  \n}' });
    }
  }, [open, initialValue, form]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(async ({ body }) => {
          await onSubmit(body as string);
        });
      }}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="body"
          rules={[
            { required: true },
            {
              validator: async (_, value) => {
                try {
                  JSON.parse(value as string);
                } catch {
                  throw new Error('Invalid JSON');
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={18} spellCheck={false} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
