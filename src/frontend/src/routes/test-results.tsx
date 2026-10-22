import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import "../../styles/common.scss"
import axios from "axios";
import {
    ButtonBackToTests,
    ButtonHome,
    ErrorCard,
    LoadingSpinner,
    PageContainer
} from "../components/utilComponents.tsx";
import type {TestSchema} from "../components/test-commons.ts";
import {config} from "../config.ts";



export default function TestResults() {
    const { testId } = useParams<{ testId: string }>();

    const [dataTestEntry, setDataTestEntry] = useState<TestSchema | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        axios.get<TestSchema>(`${config.apiEndpoint}/test-entries/${testId}`)
            .then(r => {
                setDataTestEntry(r.data);
            })
            .catch((e) => {
                setError(e.message || "An error occurred.");
            })
            .finally(() => {
                setLoading(false);
            })

    }, []);

    if (loading) {
        return (
            <PageContainer>
                <ButtonHome />
                <ButtonBackToTests />
                <LoadingSpinner />
            </PageContainer>
        );
    }

    if (error || !dataTestEntry) {
        return (
            <PageContainer>
                <ButtonHome />
                <ButtonBackToTests />
                <ErrorCard title="Failed to load test results" error={error || "Could not retrieve data."} />
            </PageContainer>
        );
    }


    return (
        <PageContainer>
            <ButtonHome />
            <ButtonBackToTests />
            <div className="container-md py-4" style={{ maxWidth: '900px' }}>
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
                    <div>
                        <h1 className="h3 fw-bold m-0">Test results</h1>
                        <span className="font-monospace small">ID: {dataTestEntry.test_id}</span>
                    </div>
                </div>


                <div className="card bg-secondary p-4 shadow mb-3 border-0" style={{ borderRadius: '1rem' }}>
                    // Here insert the chart
                </div>

                <div className="d-flex justify-content-center gap-4 text-muted small px-2 font-monospace">
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', marginRight: 4 }}></span> Pull Phase (7s)</div>
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', marginRight: 4 }}></span> Rest/Prep Phase (3s/10s)</div>
                </div>

            </div>
        </PageContainer>
    );
}