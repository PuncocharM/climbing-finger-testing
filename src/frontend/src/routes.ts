import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("test-critical-force-repeaters", "routes/test-critical-force-repeaters.tsx"),
    route("test-critical-force-sustain", "routes/test-critical-force-sustain.tsx", ),
    route("test-peak-force", "routes/test-peak-force.tsx"),
    route("test-results/:testId", "routes/test-results.tsx"),
    route("history", "routes/history.tsx"),
] satisfies RouteConfig;
