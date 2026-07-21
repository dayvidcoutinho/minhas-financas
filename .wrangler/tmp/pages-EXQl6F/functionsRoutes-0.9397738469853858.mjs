import { onRequestGet as __api_sync_js_onRequestGet } from "C:\\Claude\\Pessoal\\minhas-financas\\functions\\api\\sync.js"
import { onRequestPost as __api_sync_js_onRequestPost } from "C:\\Claude\\Pessoal\\minhas-financas\\functions\\api\\sync.js"

export const routes = [
    {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_sync_js_onRequestGet],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_js_onRequestPost],
    },
  ]