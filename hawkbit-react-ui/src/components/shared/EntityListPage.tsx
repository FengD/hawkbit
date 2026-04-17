import { Button, Card, Modal, Space, Typography, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HawkbitEntity } from '../../types/api';
import { QueryFilter } from './QueryFilter';
import { ServerTable } from './ServerTable';
import { JsonEditorModal } from './JsonEditorModal';
import { toErrorMessage } from '../../utils/normalize';

interface EntityListPageProps<T extends HawkbitEntity> {
  title: string;
  columns: ColumnsType<T>;
  list: (query: { offset: number; limit: number; sort?: string; q?: string }) => Promise<{ items: T[]; total: number }>;
  create?: (payload: Record<string, unknown>) => Promise<unknown>;
  remove?: (ids: Array<string | number>) => Promise<unknown>;
  extraActions?: (selected: T[], reload: () => Promise<void>) => React.ReactNode;
}

export const EntityListPage = <T extends HawkbitEntity>({ title, columns, list, create, remove, extraActions }: EntityListPageProps<T>) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<string | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const query = searchParams.get('q') ?? '';
  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await list({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        sort,
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
  }, [list, page, pageSize, query, sort, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowKeys.includes(row.id)),
    [rows, selectedRowKeys],
  );

  return (
    <Card title={<Typography.Title level={4}>{title}</Typography.Title>}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <QueryFilter
          value={draftQuery}
          onChange={setDraftQuery}
          onApply={() => {
            const next = new URLSearchParams(searchParams);
            if (draftQuery.trim()) {
              next.set('q', draftQuery.trim());
            } else {
              next.delete('q');
            }
            setSearchParams(next);
            setPage(1);
          }}
          onReset={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('q');
            setSearchParams(next);
            setDraftQuery('');
            setPage(1);
          }}
        />

        <Space>
          <Button onClick={() => void reload()}>{t('common.refresh')}</Button>
          {create && <Button type="primary" onClick={() => setCreateOpen(true)}>{t('common.create')}</Button>}
          {remove && (
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              onClick={() => {
                Modal.confirm({
                  title: t('common.confirmDelete'),
                  onOk: async () => {
                    try {
                      await remove(selectedRowKeys);
                      notification.success({ message: t('common.deleted') });
                      await reload();
                    } catch (error) {
                      notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
                    }
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          {extraActions?.(selectedRows, reload)}
        </Space>

        <ServerTable<T>
          loading={loading}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          selectedRowKeys={selectedRowKeys}
          columns={columns}
          onPageChange={(nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          }}
          onSortChange={setSort}
          onSelectionChange={setSelectedRowKeys}
        />
      </Space>

      {create && (
        <JsonEditorModal
          open={createOpen}
          title={`${t('common.create')} ${title}`}
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (body) => {
            try {
              await create(JSON.parse(body) as Record<string, unknown>);
              notification.success({ message: t('common.created') });
              setCreateOpen(false);
              await reload();
            } catch (error) {
              notification.error({ message: t('common.failed'), description: toErrorMessage(error) });
            }
          }}
        />
      )}
    </Card>
  );
};
