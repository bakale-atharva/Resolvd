import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config.js";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import presence from "@convex-dev/presence/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();
app.use(agent);
app.use(rag);
app.use(presence);
app.use(rateLimiter);
app.use(workpool);
app.use(aggregate);

export default app;
