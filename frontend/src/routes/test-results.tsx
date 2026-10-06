// app/routes/test-results.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import "../../styles/common.scss"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface PhaseMarker {
    offset_seconds: number;
    type: 'CRITICAL_FORCE' | 'PULL' | 'REST' | 'TEST_END';
}

interface TestAnalytics {
    test_id: string;
    timestamp: string;
    test_type: string;
    critical_force_kg: number;
    w_prime_joules: number;
    r_squared: number;
    set_peaks: number[];
    raw_timeline: number[];
    raw_forces: number[];
    phase_markers: PhaseMarker[]; // Parsed intervals configuration array
}

export default function TestResults(): React.JSX.Element {
    const { testId } = useParams<{ testId: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<TestAnalytics | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);

    useEffect(() => {
        if (!testId) return;
        let isMounted = true;

        const fetchData = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/history/${testId}`);
                if (response.status === 404 && retryCount < 5) {
                    setTimeout(() => { if (isMounted) setRetryCount((prev) => prev + 1); }, 1500);
                    return;
                }
                if (!response.ok) throw new Error(`Server returned status code: ${response.status}`);
                const json: TestAnalytics = await response.json();
                if (isMounted) {
                    setData(json);
                    setLoading(false);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || "An error occurred.");
                    setLoading(false);
                }
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [testId, retryCount]);

    if (loading) {
        return (
            <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center">
                <div className="spinner-border text-success mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                <h2 className="h5 fw-bold">Processing 80 Hz Telemetry Curves...</h2>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-dark text-light min-vh-screen d-flex align-items-center justify-content-center p-3">
                <div className="card bg-danger p-4 text-center border-0" style={{ maxWidth: '400px' }}>
                    <h3 className="h5 fw-bold mb-2">Analysis Failed</h3>
                    <p className="small opacity-75 mb-4">{error || "Could not retrieve data."}</p>
                    <button onClick={() => navigate("/history")} className="btn btn-light fw-bold w-100">Back to Logs</button>
                </div>
            </div>
        );
    }

    // --- High-Performance Core Custom Shading Plugin Setup ---
    const phaseBandsPlugin = {
        id: 'phaseBands',
        beforeDraw: (chart: any) => {
            const { ctx, chartArea: { top, bottom }, scales: { x, y } } = chart;
            const markers = data.phase_markers;

            if (!markers || markers.length < 2) return;

            ctx.save();

            ctx.globalCompositeOperation = 'destination-over';

            // x.getPixelForValue(10);

            // ctx.fillStyle = options.color;
            // ctx.fillRect(0, 0, chart.width, chart.height);

            // Step through markers sequentially to draw background blocks between timestamps
            for (let i = 0; i < markers.length - 1; i++) {
                const startSec = markers[i].offset_seconds;
                const endSec = markers[i+1].offset_seconds;
                const currentPhase = markers[i].type;

                // Convert elapsed seconds positions into raw screen pixel coordinate channels
                // Using index matching properties against your categorical timeline scale labels array
                const xStartIdx = data.raw_timeline.findIndex(t => t >= startSec);
                const xEndIdx = data.raw_timeline.findIndex(t => t >= endSec);

                if (xStartIdx === -1) continue;

                const pixelLeft = x.getPixelForValue(xStartIdx);
                const pixelRight = xEndIdx !== -1 ? x.getPixelForValue(xEndIdx) : chart.chartArea.right;
                const width = pixelRight - pixelLeft;

                // Assign background fill alpha variants based on the operational protocol tier
                if (currentPhase === 'PULL') {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'; // Soft Red overlay for high tension pulls
                } else {
                    // Handles both 'REST' loops and the initial 'CRITICAL_FORCE' (countdown) blocks
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.04)'; // Subtle Blue overlay for rest slots
                }

                ctx.fillRect(pixelLeft, top, width, bottom - top);
            }
            ctx.restore();
        }
    };

    // --- Chart Layout Configurations ---
    const chartData = {
        labels: data.raw_timeline.map(t => `${t}s`),
        datasets: [
            {
                label: 'Continuous Load Cell Profile (80 Hz)',
                data: data.raw_forces,
                borderColor: '#10b981',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0,
                fill: false,
            },
            {
                label: 'Critical Force Line',
                data: Array(data.raw_timeline.length).fill(data.critical_force_kg),
                borderColor: '#f59e0b',
                borderDash: [5,5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            y: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa' } },
            x: { grid: { display: false }, ticks: { color: '#a1a1aa', maxTicksLimit: 15 } }
        },
        plugins: {
            legend: { labels: { color: '#f8fafc' } },
            tooltip: { mode: 'index' as const, intersect: false }
        }
    };

    return (
        <div className="bg-dark text-light min-vh-screen p-4">
            <div className="container-md py-4" style={{ maxWidth: '900px' }}>

                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
                    <div>
                        <h1 className="h3 fw-bold m-0">Fatigue Profile Analysis</h1>
                        <span className="text-muted font-monospace small">ID: {data.test_id}</span>
                    </div>
                    <div className="d-inline-flex gap-2">
                        <button onClick={() => navigate("/history")} className="btn btn-outline-info rounded-3 fw-bold">📋 All Tests</button>
                        <button onClick={() => navigate("/")} className="btn btn-outline-light rounded-3 fw-bold">🏠 Home</button>
                    </div>
                </div>

                {/* Metrics Grid Area */}
                <div className="row g-3 mb-4">
                    <div className="col-md-4">
                        <div className="card bg-secondary p-3 text-center border-0 shadow">
                            <span className="text-muted small fw-bold d-block mb-1">Critical Force</span>
                            <div className="h3 font-monospace fw-bold text-warning">{data.critical_force_kg.toFixed(2)} kg</div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card bg-secondary p-3 text-center border-0 shadow">
                            <span className="text-muted small fw-bold d-block mb-1">W' (W-Prime Energy)</span>
                            <div className="h3 font-monospace fw-bold text-success">{data.w_prime_joules.toFixed(0)} J</div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card bg-secondary p-3 text-center border-0 shadow">
                            <span className="text-muted small fw-bold d-block mb-1">Model Fit (R²)</span>
                            <div className="h3 font-monospace fw-bold text-info">{(data.r_squared * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>

                {/* Chart Card */}
                <div className="card bg-secondary p-4 shadow mb-3 border-0" style={{ borderRadius: '1rem' }}>
                    <h2 className="h6 fw-bold mb-3">80 Hz Telemetry Waveform with Contextual Blocks</h2>
                    <div style={{ height: '380px', position: 'relative' }}>
                        {/* Inject the custom bands plugin inside the canvas component props mapping */}
                        <Line data={chartData} options={chartOptions} plugins={[phaseBandsPlugin]} />
                    </div>
                </div>

                <div className="d-flex justify-content-center gap-4 text-muted small px-2 font-monospace">
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', marginRight: 4 }}></span> Pull Phase (7s)</div>
                    <div><span className="d-inline-block rounded" style={{ width: 12, height: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', marginRight: 4 }}></span> Rest/Prep Phase (3s/10s)</div>
                </div>

            </div>
        </div>
    );
}