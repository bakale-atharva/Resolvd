/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as articles from "../articles.js";
import type * as crawler from "../crawler.js";
import type * as crawlerNode from "../crawlerNode.js";
import type * as documents from "../documents.js";
import type * as documentsNode from "../documentsNode.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_ssrf from "../lib/ssrf.js";
import type * as memberships from "../memberships.js";
import type * as rag from "../rag.js";
import type * as widget from "../widget.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  articles: typeof articles;
  crawler: typeof crawler;
  crawlerNode: typeof crawlerNode;
  documents: typeof documents;
  documentsNode: typeof documentsNode;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/ssrf": typeof lib_ssrf;
  memberships: typeof memberships;
  rag: typeof rag;
  widget: typeof widget;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  workpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workpool">;
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
};
