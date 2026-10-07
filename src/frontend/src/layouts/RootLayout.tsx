import React from 'react';
import {Links, Meta, Scripts, ScrollRestoration} from "react-router";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Scale</title>
            <Links />
            <Meta />
        </head>
        <body>
        <div className="app-container">
            {children}
        </div>
        <ScrollRestoration />
        <Scripts />
        </body>
        </html>
    );
}
