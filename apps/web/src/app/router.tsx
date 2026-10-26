import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { HistoryPage } from '../modules/history';
import { RampPage } from '../modules/ramp';
import { AppShell } from './AppShell';

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RampPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  validateSearch: (
    search: Record<string, unknown>,
  ): { campaignId?: string } => ({
    campaignId:
      typeof search.campaignId === 'string' && search.campaignId.length > 0
        ? search.campaignId
        : undefined,
  }),
  component: HistoryPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, historyRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
