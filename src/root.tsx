// src/App.tsx
import {
    Outlet,
} from "react-router";
import {StrictMode} from "react";

export default function Root() {
    return <StrictMode><Outlet /></StrictMode>
}