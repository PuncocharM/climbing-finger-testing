import {useNavigate} from "react-router";
import React from "react";


export function PageContainer({children}: { children: React.ReactNode }) {
    return <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center p-3">
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

function ButtonBack({path, title} : {path: string, title: string}) {
    const navigate = useNavigate()

    return (
        <div className="flex-column align-items-start justify-content-lg-start w-100">
        <button onClick={() => navigate(path)}
                       className="btn btn-outline-secondary btn-sm mb-3">
            ← {title}
        </button>
        </div>
    )
}

export function ButtonHome() {
    return <ButtonBack path="/" title="Back to Scale Dashboard" />
}

export function ButtonBackToTests() {
    return <ButtonBack path="/history" title="Back to all tests" />
}

export function LoadingSpinner() {
    return <div className="d-flex justify-content-center">
        <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
        </div>
    </div>;
}

export function ErrorCard({title, error}: {title: string, error: string}) {
    return <div className="card bg-danger p-4 text-center border-0 shadow w-100" style={{maxWidth: '400px'}}>
        <h3 className="h5 fw-bold mb-2">{title}</h3>
        <p className="small opacity-75 mb-4">{error}</p>
    </div>;
}
