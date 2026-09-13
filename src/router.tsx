import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

function routerBasepath() {
  const base = import.meta.env.BASE_URL || "/";
  if (base === "/") return undefined;
  return base.replace(/\/$/, "") || undefined;
}

export function getRouter() {
  const basepath = routerBasepath();
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    ...(basepath ? { basepath } : {}),
  });
}
