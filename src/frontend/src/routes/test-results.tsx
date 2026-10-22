import {useEffect, useRef, useState} from 'react';
import {useParams} from 'react-router';
import "../../styles/common.scss"
import axios from "axios";
import {Chart as ChartJS} from "chart.js";

import {
    ButtonBackToTests,
    ButtonHome,
    ErrorCard,
    LoadingSpinner,
    PageContainer
} from "../components/utilComponents.tsx";
import {type ScaleData, type TestEventSchema, type TestSchema, TestType} from "../components/test-commons.ts";
import {config} from "../config.ts";

import Chart from "../components/ChartTestData.tsx";
import {TestResultsPeakForce} from "../components/TestResultsPeakForce.tsx";


export default function TestResults() {
    const { testId } = useParams<{ testId: string }>();

    const [testEntry, setTestEntry] = useState<TestSchema | null>(null);
    const [testEvents, setTestEvents] = useState<TestEventSchema[]>([]);
    const [scaleData, setScaleData] = useState<ScaleData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const chartRef = useRef<ChartJS<'line'> | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        Promise.all([
            axios.get<TestSchema>(`${config.apiEndpoint}/test-entries/${testId}`),
            axios.get<TestEventSchema[]>(`${config.apiEndpoint}/test-entries/${testId}/test-events`),
            axios.get<ScaleData>(`${config.apiEndpoint}/test-entries/${testId}/scale-data`),
        ])
            .then(([entryRes, eventsRes, scaleRes]) => {
                setTestEntry(entryRes.data);
                setTestEvents(eventsRes.data);
                setScaleData(scaleRes.data);

                if (eventsRes.data.length == 0) {
                    setError("No events found for the test entry");
                }
            })
            .catch((e) => {
                setError(e.response?.data?.detail || e.message || "An error occurred.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [testId]);



    if (loading) {
        return (
            <PageContainer>
                <ButtonHome />
                <ButtonBackToTests />
                <LoadingSpinner />
            </PageContainer>
        );
    }

    if (error || !testEntry) {
        return (
            <PageContainer>
                <ButtonHome />
                <ButtonBackToTests />
                <ErrorCard title="Failed to load test results" error={error || "Could not retrieve data."} />
            </PageContainer>
        );
    }

    const hasData = !!scaleData && scaleData.timestamps.length > 0;

    return (
        <PageContainer>
            <ButtonHome />
            <ButtonBackToTests />
            <div className="container-md py-4" style={{ maxWidth: '900px' }}>
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-2">
                    <div className="mb-4">
                        <h1 className="h3 fw-bold m-0">Test results</h1>
                        <div className="font-monospace small">ID: {testEntry.test_id}</div>
                        <div className="font-monospace small"><span className="text-capitalize">{testEntry.test_arm}</span> arm</div>
                        {
                            testEntry.test_type == TestType.PEAK_FORCE && <TestResultsPeakForce testId={testEntry.test_id} />
                        }
                    </div>
                    {hasData && (
                        <div className="btn-group btn-group-sm  mt-auto mb-0" role="group" aria-label="Chart zoom controls">
                            <button type="button" className="btn btn-outline-light"
                                    onClick={() => chartRef.current?.zoom(1.25)}>+</button>
                            <button type="button" className="btn btn-outline-light"
                                    onClick={() => chartRef.current?.zoom(0.8)}>−</button>
                            <button type="button" className="btn btn-outline-light"
                                    onClick={() => chartRef.current?.resetZoom()}>Reset zoom</button>
                        </div>
                    )}
                </div>


                <div className="card bg-light p-4 shadow mb-3 border-0" style={{ borderRadius: '1rem' }}>
                    {hasData ? (
                        <div style={{ position: 'relative', height: 420 }}>
                            <Chart testEvents={testEvents} scaleData={scaleData} chartRef={chartRef} />
                        </div>
                    ) : (
                        <div className="text-center py-5">No scale data recorded for this test.</div>
                    )}
                </div>

                <div className="text-center text-muted small mb-2">
                    Scroll to zoom · drag to pan · hover or tap a point for exact values
                </div>

                <div className="d-flex justify-content-center gap-4 text-muted small px-2 font-monospace">
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', marginRight: 4 }}></span> Pull Phase (7s)</div>
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', marginRight: 4 }}></span> Rest/Prep Phase (3s/10s)</div>
                </div>

            </div>
        </PageContainer>
    );
}
