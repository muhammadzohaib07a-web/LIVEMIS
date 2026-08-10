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
    defaultPendingMs: 200,
    defaultPendingMinMs: 400,
  });

  return router;
};
