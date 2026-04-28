import axios from 'axios';
import type { Review, ReviewStatus, ReviewsResponse, GlobalStats, Reminder } from './types';
import { API_BASE, BACKOFFICE_KEY } from './config';

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

if (BACKOFFICE_KEY) {
  api.interceptors.request.use((config) => {
    config.headers['X-Backoffice-Key'] = BACKOFFICE_KEY;
    return config;
  });
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const path = typeof err.config?.url === 'string' ? err.config.url : '';
    if (status === 401 && !/\/auth\/(login|me)/.test(path)) {
      if (onUnauthorized) onUnauthorized();
    }
    if (status === 404) {
      const hint =
        API_BASE === '/api'
          ? ' L’API n’est pas sur ce domaine : en prod, définissez VITE_API_URL (URL du backend sans /api) sur Vercel et redéployez.'
          : ' Vérifiez que le backend tourne et que VITE_API_URL est l’origine correcte (sans /api en double).';
      err.message = (err.response?.data?.error as string) || `404 — route introuvable (${path}).${hint}`;
    } else if (err.response?.data?.error) {
      err.message = err.response.data.error as string;
    }
    return Promise.reject(err);
  },
);

export default api;

// ── Auth & utilisateurs ────────────────────────────────────────────────────

export type UserRole = 'admin' | 'agent';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export const login = (email: string, password: string): Promise<{ user: AuthUser }> =>
  api.post('/auth/login', { email, password }).then((r) => r.data);

export const logout = (): Promise<{ ok: true }> =>
  api.post('/auth/logout').then((r) => r.data);

export const fetchMe = (): Promise<{ user: AuthUser }> =>
  api.get('/auth/me').then((r) => r.data);

export const fetchUsers = (): Promise<{ users: AuthUser[] }> =>
  api.get('/users').then((r) => r.data);

export const createUserApi = (data: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}): Promise<{ user: AuthUser }> => api.post('/users', data).then((r) => r.data);

export const updateUserApi = (
  id: number,
  data: { name?: string; email?: string; role?: UserRole; password?: string },
): Promise<{ user: AuthUser }> => api.patch(`/users/${id}`, data).then((r) => r.data);

export const deleteUserApi = (id: number): Promise<{ ok: true }> =>
  api.delete(`/users/${id}`).then((r) => r.data);

export interface FetchReviewsParams {
  site?: string;
  source?: string;
  status?: ReviewStatus;
  rating?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'published_at' | 'created_at' | 'rating' | 'author' | 'status' | 'source';
  sort_dir?: 'asc' | 'desc';
}

export const fetchReviews = (params: FetchReviewsParams = {}): Promise<ReviewsResponse> =>
  api.get('/reviews', {
    params: {
      sort_by: 'published_at',
      sort_dir: 'desc',
      ...params,
    },
  }).then((r) => r.data);

export const fetchStats = (): Promise<GlobalStats> =>
  api.get('/reviews/stats').then(r => r.data);

export const fetchAnalytics = (): Promise<any> =>
  api.get('/analytics').then(r => r.data);

export const updateReview = (id: number, data: Partial<Pick<Review, 'status' | 'note' | 'assigned_to' | 'agents' | 'contacted_at'>>): Promise<Review> =>
  api.patch(`/reviews/${id}`, data).then(r => r.data);

export const bulkUpdateStatus = (ids: number[], status: ReviewStatus): Promise<{ updated: number }> =>
  api.patch('/reviews/bulk/status', { ids, status }).then(r => r.data);

// ── Responses ──────────────────────────────────────────────────────────────

export interface Response {
  id: number;
  review_id: number;
  author: string;
  content: string;
  is_published: number;
  published_on: string;
  created_at: string;
  updated_at: string;
}

export const fetchResponses = (reviewId: number): Promise<Response[]> =>
  api.get(`/reviews/${reviewId}/responses`).then(r => r.data);

export const createResponse = (reviewId: number, data: { author?: string; content: string; is_published?: boolean; published_on?: string }): Promise<Response> =>
  api.post(`/reviews/${reviewId}/responses`, data).then(r => r.data);

export const updateResponse = (reviewId: number, responseId: number, data: Partial<{ content: string; author: string; is_published: boolean; published_on: string }>): Promise<Response> =>
  api.patch(`/reviews/${reviewId}/responses/${responseId}`, data).then(r => r.data);

export const deleteResponse = (reviewId: number, responseId: number): Promise<void> =>
  api.delete(`/reviews/${reviewId}/responses/${responseId}`).then(r => r.data);

// ── Reminders ───────────────────────────────────────────────────────────────

export const fetchReminders = (params?: { status?: string; review_id?: number }): Promise<Reminder[]> =>
  api.get('/reminders', { params }).then(r => r.data);

export const createReminder = (data: { review_id?: number; message: string; remind_at: string }): Promise<Reminder> =>
  api.post('/reminders', data).then(r => r.data);

export const updateReminder = (id: number, data: { status: 'pending' | 'triggered' | 'dismissed' }): Promise<Reminder> =>
  api.patch(`/reminders/${id}`, data).then(r => r.data);

export const deleteReminder = (id: number): Promise<void> =>
  api.delete(`/reminders/${id}`).then(r => r.data);

// ── Historique : avis sauvegardés ──────────────────────────────────────────

export interface SavedReview {
  review: Review;
  savedAt: string;
}

export const fetchSavedReviews = (): Promise<SavedReview[]> =>
  api.get('/historique/saved-reviews').then(r => r.data);

export const saveReviewToHistorique = (review: Review): Promise<SavedReview> =>
  api.post('/historique/saved-reviews', { review }).then(r => r.data);

export const unsaveReviewFromHistorique = (id: number): Promise<{ ok: boolean }> =>
  api.delete(`/historique/saved-reviews/${id}`).then(r => r.data);

// ── Scraping ────────────────────────────────────────────────────────────────

export const triggerScraping = (
  site?: string,
  source?: string,
  opts: { quick?: boolean } = {}
): Promise<void> =>
  api.post('/scraping/run', { site, source, quick: opts.quick ?? true }).then(r => r.data);

// Le bouton "Tout synchroniser" du back-office passe quick=true par défaut :
// 3 pages Trustpilot par site (~4 min) au lieu de 10 (~15 min).
// Le cron quotidien (4h) déclenché côté backend ignore ce flag et reste à 10 pages.
export const triggerScrapingAll = (opts: { quick?: boolean } = {}): Promise<void> =>
  api.post('/scraping/run-all', { quick: opts.quick ?? true }).then(r => r.data);

export const fetchScrapingLogs = () =>
  api.get('/scraping/logs').then(r => r.data);

export const fetchScrapingStatus = () =>
  api.get('/scraping/status').then(r => r.data);
