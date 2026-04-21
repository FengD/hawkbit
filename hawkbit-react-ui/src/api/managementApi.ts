import { httpClient } from './httpClient';
import type { HawkbitEntity, ListQuery, PermissionMap } from '../types/api';
import { normalizePageResponse } from '../utils/normalize';

interface UserInfoResponse {
  tenant?: string;
  username?: string;
  permissions?: string[];
}

const list = async <T>(path: string, query: ListQuery) => {
  const response = await httpClient.get(path, {
    params: {
      offset: query.offset ?? 0,
      limit: query.limit ?? 20,
      sort: query.sort,
      q: query.q,
    },
  });

  return normalizePageResponse<T>(response.data);
};

const hasAnyPermission = (permissions: string[], expected: string[]): boolean =>
  expected.some((permission) => permissions.includes(permission));

const isAdminPermission = (permissions: string[]): boolean =>
  permissions.some((permission) => permission.includes('ADMIN'));

const toPermissionMap = (permissions: string[]): PermissionMap => ({
  targets: hasAnyPermission(permissions, ['READ_TARGET', 'TENANT_ADMIN']),
  targetFilters: hasAnyPermission(permissions, ['READ_TARGET', 'TENANT_ADMIN']),
  rollouts: hasAnyPermission(permissions, ['READ_ROLLOUT', 'TENANT_ADMIN']),
  distributionSets: hasAnyPermission(permissions, ['READ_REPOSITORY', 'TENANT_ADMIN']),
  softwareModules: hasAnyPermission(permissions, ['READ_REPOSITORY', 'TENANT_ADMIN']),
  config: hasAnyPermission(permissions, ['READ_TENANT_CONFIGURATION', 'TENANT_ADMIN']),
});

export const managementApi = {
  validateBasicAuth: async (): Promise<{ username: string; tenant: string; permissions: PermissionMap }> => {
    const response = await httpClient.get<UserInfoResponse>('/userinfo');
    const payload = response.data ?? {};
    return {
      username: payload.username ?? '',
      tenant: payload.tenant ?? 'DEFAULT',
      permissions: toPermissionMap(payload.permissions ?? []),
    };
  },

  probeSession: async () => {
    await httpClient.get('/userinfo');
  },

  loadPermissions: async (): Promise<PermissionMap> => {
    const userInfo = await httpClient.get<UserInfoResponse>('/userinfo');
    const declaredPermissions = userInfo.data?.permissions ?? [];
    const declared = toPermissionMap(declaredPermissions);

    if (isAdminPermission(declaredPermissions)) {
      return {
        targets: true,
        targetFilters: true,
        rollouts: true,
        distributionSets: true,
        softwareModules: true,
        config: true,
      };
    }

    const checks = await Promise.allSettled([
      httpClient.get('/targets', { params: { offset: 0, limit: 1 } }),
      httpClient.get('/targetfilters', { params: { offset: 0, limit: 1 } }),
      httpClient.get('/rollouts', { params: { offset: 0, limit: 1 } }),
      httpClient.get('/distributionsets', { params: { offset: 0, limit: 1 } }),
      httpClient.get('/softwaremodules', { params: { offset: 0, limit: 1 } }),
      httpClient.get('/system/configs'),
    ]);

    return {
      targets: declared.targets || checks[0].status === 'fulfilled',
      targetFilters: declared.targetFilters || checks[1].status === 'fulfilled',
      rollouts: declared.rollouts || checks[2].status === 'fulfilled',
      distributionSets: declared.distributionSets || checks[3].status === 'fulfilled',
      softwareModules: declared.softwareModules || checks[4].status === 'fulfilled',
      config: declared.config || checks[5].status === 'fulfilled',
    };
  },

  listTargetTypes: async () => {
    const response = await httpClient.get('/targettypes', { params: { offset: 0, limit: 100, sort: 'name:asc' } });
    return normalizePageResponse<HawkbitEntity>(response.data).items;
  },

  listTargets: (query: ListQuery) => list<HawkbitEntity>('/targets', query),
  getTarget: async (id: string | number) => {
    const response = await httpClient.get(`/targets/${id}`);
    return response.data as HawkbitEntity;
  },
  createTarget: (payload: Record<string, unknown>) => httpClient.post('/targets', [payload]),
  updateTarget: (id: string | number, payload: Record<string, unknown>) => httpClient.put(`/targets/${id}`, payload),
  deleteTargets: (ids: Array<string | number>) => Promise.all(ids.map((id) => httpClient.delete(`/targets/${id}`))),
  getTargetActions: (id: string | number) => httpClient.get(`/targets/${id}/actions`),
  getTargetMetadata: (id: string | number) => httpClient.get(`/targets/${id}/metadata`),
  createTargetMetadata: (id: string | number, key: string, value: string) =>
    httpClient.post(`/targets/${id}/metadata`, [{ key, value }]),
  deleteTargetMetadata: (id: string | number, key: string) => httpClient.delete(`/targets/${id}/metadata/${key}`),
  assignDistributionSet: (id: string | number, distributionSetId: string | number, actionType = 'FORCED') =>
    httpClient.post(`/targets/${id}/assignedDS`, { id: distributionSetId, type: actionType }),

  listTargetGroups: async () => {
    const response = await httpClient.get('/targetgroups');
    return (response.data ?? []) as string[];
  },
  getGroupAssignedTargets: async (group: string, query: ListQuery, includeSubgroups = true) => {
    const response = await httpClient.get('/targetgroups/assigned', {
      params: {
        group,
        subgroups: includeSubgroups,
        offset: query.offset ?? 0,
        limit: query.limit ?? 20,
        sort: query.sort,
      },
    });

    return normalizePageResponse<HawkbitEntity>(response.data);
  },
  assignTargetsToGroup: (group: string, controllerIds: string[]) =>
    httpClient.put('/targetgroups/assigned', controllerIds, { params: { group } }),
  unassignTargetsFromGroup: (controllerIds: string[]) => httpClient.delete('/targetgroups/assigned', { data: controllerIds }),

  listTargetFilters: (query: ListQuery) => list<HawkbitEntity>('/targetfilters', query),
  createTargetFilter: (payload: Record<string, unknown>) => httpClient.post('/targetfilters', payload),
  updateTargetFilter: (id: string | number, payload: Record<string, unknown>) => httpClient.put(`/targetfilters/${id}`, payload),
  deleteTargetFilters: (ids: Array<string | number>) => Promise.all(ids.map((id) => httpClient.delete(`/targetfilters/${id}`))),
  assignTargetFilterDistributionSet: (id: string | number, distributionSetId: string | number, actionType = 'FORCED') =>
    httpClient.post(`/targetfilters/${id}/assignedDistributionSet`, { id: distributionSetId, type: actionType }),
  cancelTargetFilterDistributionSet: (id: string | number) => httpClient.delete(`/targetfilters/${id}/assignedDistributionSet`),

  listRollouts: (query: ListQuery) => list<HawkbitEntity>('/rollouts', { ...query }),
  getRollout: (id: string | number) => httpClient.get(`/rollouts/${id}`).then((res) => res.data as HawkbitEntity),
  createRollout: (payload: Record<string, unknown>) => httpClient.post('/rollouts', payload),
  updateRollout: (id: string | number, payload: Record<string, unknown>) => httpClient.put(`/rollouts/${id}`, payload),
  deleteRollouts: (ids: Array<string | number>) => Promise.all(ids.map((id) => httpClient.delete(`/rollouts/${id}`))),
  rolloutAction: (
    id: string | number,
    action: 'start' | 'pause' | 'resume' | 'stop' | 'retry' | 'approve' | 'deny' | 'triggerNextGroup',
  ) => httpClient.post(`/rollouts/${id}/${action}`),
  listRolloutGroups: (id: string | number, query: ListQuery) => {
    return httpClient.get(`/rollouts/${id}/groups`, {
      params: {
        offset: query.offset ?? 0,
        limit: query.limit ?? 100,
        sort: query.sort,
      },
    }).then((res) => normalizePageResponse<HawkbitEntity>(res.data).items);
  },

  listDistributionSetTypes: async () => {
    const response = await httpClient.get('/distributionsettypes', { params: { offset: 0, limit: 100, sort: 'name:asc' } });
    return normalizePageResponse<HawkbitEntity>(response.data).items;
  },

  listDistributionSets: (query: ListQuery) => list<HawkbitEntity>('/distributionsets', query),
  getDistributionSet: async (id: string | number) => {
    const response = await httpClient.get(`/distributionsets/${id}`);
    return response.data as HawkbitEntity;
  },
  createDistributionSet: (payload: Record<string, unknown>) => httpClient.post('/distributionsets', [payload]),
  updateDistributionSet: (id: string | number, payload: Record<string, unknown>) =>
    httpClient.put(`/distributionsets/${id}`, payload),
  deleteDistributionSets: (ids: Array<string | number>) => Promise.all(ids.map((id) => httpClient.delete(`/distributionsets/${id}`))),
  addSoftwareModulesToDistributionSet: (id: string | number, softwareModuleIds: Array<string | number>) =>
    httpClient.post(
      `/distributionsets/${id}/assignedSM`,
      softwareModuleIds.map((moduleId) => ({ id: moduleId })),
    ),
  getDistributionSetModules: async (id: string | number) => {
    const response = await httpClient.get(`/distributionsets/${id}/assignedSM`, { params: { offset: 0, limit: 100 } });
    return normalizePageResponse<HawkbitEntity>(response.data).items;
  },

  listSoftwareModuleTypes: async () => {
    const response = await httpClient.get('/softwaremoduletypes', { params: { offset: 0, limit: 100, sort: 'name:asc' } });
    return normalizePageResponse<HawkbitEntity>(response.data).items;
  },

  listSoftwareModules: (query: ListQuery) => list<HawkbitEntity>('/softwaremodules', query),
  getSoftwareModule: async (id: string | number) => {
    const response = await httpClient.get(`/softwaremodules/${id}`);
    return response.data as HawkbitEntity;
  },
  createSoftwareModule: (payload: Record<string, unknown>) => httpClient.post('/softwaremodules', [payload]),
  updateSoftwareModule: (id: string | number, payload: Record<string, unknown>) => httpClient.put(`/softwaremodules/${id}`, payload),
  deleteSoftwareModules: (ids: Array<string | number>) => Promise.all(ids.map((id) => httpClient.delete(`/softwaremodules/${id}`))),
  getSoftwareModuleArtifacts: async (id: string | number) => {
    const response = await httpClient.get(`/softwaremodules/${id}/artifacts`);
    return (response.data ?? []) as HawkbitEntity[];
  },
  uploadSoftwareModuleArtifact: (id: string | number, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return httpClient.post(`/softwaremodules/${id}/artifacts`, body, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  listTenantConfigs: async () => {
    const response = await httpClient.get('/system/configs');
    return response.data as Record<string, { value: unknown }>;
  },
  updateTenantConfig: (key: string, value: unknown) => httpClient.put(`/system/configs/${key}`, { value }),
};
