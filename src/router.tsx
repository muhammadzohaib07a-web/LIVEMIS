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
    // Feedback has to arrive before the wait feels like a stall, so the loader
    // appears quickly and leaves as soon as the route is ready. Raising this to
    // 500ms left the previous page sitting unchanged for half a second, which
    // reads as the app having frozen rather than as it loading. The old pairing
    // had the opposite fault: a 400ms floor held the loader on screen long
    // after the route was ready.
    defaultPendingMs: 150,
    defaultPendingMinMs: 150,
  });

  return router;
};
