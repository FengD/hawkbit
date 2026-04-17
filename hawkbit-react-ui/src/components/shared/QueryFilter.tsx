import { Button, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';

interface QueryFilterProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export const QueryFilter = ({ value, onChange, onApply, onReset }: QueryFilterProps) => {
  const { t } = useTranslation();

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        placeholder={t('common.filter')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPressEnter={onApply}
      />
      <Button onClick={onApply}>{t('common.refresh')}</Button>
      <Button onClick={onReset}>{t('common.cancel')}</Button>
    </Space.Compact>
  );
};
