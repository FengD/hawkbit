export interface ApiPageResponse<T> {
  content?: T[];
  total?: number;
  size?: number;
  number?: number;
  _embedded?: Record<string, T[]>;
}

export interface ListQuery {
  offset?: number;
  limit?: number;
  sort?: string;
  q?: string;
}

export interface HawkbitEntity {
  id: string | number;
  [key: string]: unknown;
}

export interface PermissionMap {
  targets: boolean;
  targetFilters: boolean;
  rollouts: boolean;
  distributionSets: boolean;
  softwareModules: boolean;
  config: boolean;
}
