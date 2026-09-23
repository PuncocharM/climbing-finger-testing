import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("critical-force", "routes/critical-force.tsx"),
    route("test-results/:testId", "routes/test-results.tsx"),
    route("history", "routes/history.tsx"),
] satisfies RouteConfig;
