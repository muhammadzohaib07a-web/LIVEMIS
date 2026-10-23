import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LeenLoader } from "./components/LeenLoader";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start fetching a route's code + loader data as soon as the user
    // hovers/focuses its link, instead of waiting for the click — this is
    // what makes tab/nav switching feel instant instead of a beat behind.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LeenLoader />
      </div>
    ),
    // Only show the loader when a route is genuinely slow, and drop it as soon
    // as the route is ready. The old 200/400 pair meant a route that resolved
    // in 210ms was still held on screen for 600ms.
    defaultPendingMs: 500,
    defaultPendingMinMs: 150,
  });

  return router;
};
