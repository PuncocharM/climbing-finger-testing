// src/layouts/RootLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';

export default function RootLayout(): React.JSX.Element {
    return (
        <div className="app-container">
            {/*
        You can plug a shared Bootstrap Navbar or Sidebar here later.
        It will stay rendered statically while only the content inside
        the <Outlet /> swaps when switching between Home and Analytics.
      */}
            <main>
                <Outlet />
            </main>
        </div>
    );
}
