import api from '@/lib/api';
import type { CMSPage, Menu, BlogPost, Theme, ThemeSetting, ApiResponse } from '@/types';

export const cmsService = {
  // Pages
  listPages: (): Promise<ApiResponse<CMSPage[]>> =>
    api.get('/pages'),

  getPage: (id: string): Promise<ApiResponse<CMSPage>> =>
    api.get(`/pages/${id}`),

  createPage: (data: Partial<CMSPage>): Promise<ApiResponse<CMSPage>> =>
    api.post('/pages', data),

  updatePage: (id: string, data: Partial<CMSPage>): Promise<ApiResponse<CMSPage>> =>
    api.patch(`/pages/${id}`, data),

  publishPage: (id: string): Promise<ApiResponse<CMSPage>> =>
    api.post(`/pages/${id}/publish`),

  deletePage: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/pages/${id}`),

  // Menus
  listMenus: (): Promise<ApiResponse<Menu[]>> =>
    api.get('/menus'),

  updateMenu: (id: string, data: Partial<Menu>): Promise<ApiResponse<Menu>> =>
    api.patch(`/menus/${id}`, data),

  // Blog
  listPosts: (params?: { status?: string; page?: number }): Promise<ApiResponse<BlogPost[]>> =>
    api.get('/blog/posts', { params }),

  createPost: (data: Partial<BlogPost>): Promise<ApiResponse<BlogPost>> =>
    api.post('/blog/posts', data),

  updatePost: (id: string, data: Partial<BlogPost>): Promise<ApiResponse<BlogPost>> =>
    api.patch(`/blog/posts/${id}`, data),

  deletePost: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/blog/posts/${id}`),
};

export const themeService = {
  listThemes: (category?: string): Promise<ApiResponse<Theme[]>> =>
    api.get('/themes', { params: { category } }),

  getActiveTheme: (): Promise<ApiResponse<Theme>> =>
    api.get('/themes/active'),

  installTheme: (id: string): Promise<ApiResponse<Theme>> =>
    api.post(`/themes/${id}/install`),

  activateTheme: (id: string): Promise<ApiResponse<Theme>> =>
    api.post(`/themes/${id}/activate`),

  uninstallTheme: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/themes/${id}/uninstall`),

  getSettings: (id: string): Promise<ApiResponse<ThemeSetting[]>> =>
    api.get(`/themes/${id}/settings`),

  updateSettings: (id: string, settings: Record<string, any>): Promise<ApiResponse<void>> =>
    api.patch(`/themes/${id}/settings`, settings),
};
