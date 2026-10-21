import {useNavigate} from "react-router";
import React from "react";


export function PageContainer({children}: { children: React.ReactNode }) {
    return <div className="bg-dark text-light min-vh-screen d-flex align-items-center justify-content-center p-3">
        {children}
    </div>
}

export function ScaleContainer({children, bgStyle, style}: {
    children: React.ReactNode,
    bgStyle?: string,
    style?: object
}) {
    if (!bgStyle) {
        bgStyle = "bg-secondary border-secondary"
    }

    return <div className={"card shadow-lg p-4 w-100 " + bgStyle}
                style={{maxWidth: '450px', borderRadius: '1rem', ...style}}>
        {children}
    </div>
}

export function ButtonHome() {
    const navigate = useNavigate()

    return <button onClick={() => navigate("/")}
                   className="btn btn-outline-secondary btn-sm mb-4 position-absolute top-0 start-0 m-3">
        ← Back to Scale Dashboard
    </button>;
}

export function LoadingSpinner() {
    return <div className="d-flex justify-content-center">
        <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
        </div>
    </div>;
}