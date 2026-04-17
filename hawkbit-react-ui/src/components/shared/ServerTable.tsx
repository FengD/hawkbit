import { Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { HawkbitEntity } from '../../types/api';

interface ServerTableProps<T extends HawkbitEntity> {
  loading: boolean;
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  selectedRowKeys: Array<string | number>;
  columns: ColumnsType<T>;
  onPageChange: (nextPage: number, nextPageSize: number) => void;
  onSortChange: (sort?: string) => void;
  onSelectionChange: (keys: Array<string | number>) => void;
}

export const ServerTable = <T extends HawkbitEntity>({
  loading,
  rows,
  total,
  page,
  pageSize,
  selectedRowKeys,
  columns,
  onPageChange,
  onSortChange,
  onSelectionChange,
}: ServerTableProps<T>) => {
  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count) => `Total ${count}`,
  };

  return (
    <Table<T>
      rowKey={(record) => String(record.id)}
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={pagination}
      rowSelection={{
        selectedRowKeys,
        onChange: (keys) => onSelectionChange(keys as Array<string | number>),
      }}
      onChange={(nextPagination, _, sorter) => {
        onPageChange(nextPagination.current ?? 1, nextPagination.pageSize ?? pageSize);

        if (!Array.isArray(sorter)) {
          if (sorter.field && sorter.order) {
            onSortChange(`${String(sorter.field)}:${sorter.order === 'ascend' ? 'ASC' : 'DESC'}`);
          } else {
            onSortChange(undefined);
          }
        }
      }}
    />
  );
};
