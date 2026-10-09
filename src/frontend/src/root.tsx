/// <reference types="vite/client" />

import {
    isRouteErrorResponse,
    Outlet,
} from "react-router";
import type { Route } from "./+types/root";
import React from "react";
import RootLayout from "./layouts/RootLayout.tsx";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <RootLayout children={children} />
    );
}

export default function Root() {
    return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details =
            error.status === 404
                ? "The requested page could not be found."
                : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className="pt-16 p-4 container mx-auto">
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
            )}
        </main>
    );
}