import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './Layout';
import { HomePage } from './pages/HomePage';
// @if db
import { ItemsPage } from './pages/ItemsPage';
// @endif
// @if ai
import { AskPage } from './pages/AskPage';
// @endif
// @if agent
import { AgentPage } from './pages/AgentPage';
// @endif

// Routes are declared in code: add a page here and a link in Layout.tsx.
const rootRoute = createRootRoute({ component: Layout });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
// @if db
const itemsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/items', component: ItemsPage });
// @endif
// @if ai
const askRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ask', component: AskPage });
// @endif
// @if agent
const agentRoute = createRoute({ getParentRoute: () => rootRoute, path: '/assistant', component: AgentPage });
// @endif

const routeTree = rootRoute.addChildren([
  homeRoute,
// @if db
  itemsRoute,
// @endif
// @if ai
  askRoute,
// @endif
// @if agent
  agentRoute,
// @endif
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
