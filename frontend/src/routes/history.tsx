// app/routes/history.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import "../../styles/common.scss"

interface HistoricalTestRecord {
    test_id: string;
    timestamp: string;
    test_type: string;
    critical_force_kg: number;
    w_prime_joules: number;
    r_squared: number;
}

export default function TestingHistory(): React.JSX.Element {
    const navigate = useNavigate();

    const [tests, setTests] = useState<HistoricalTestRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistoryData = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/history");
            if (!response.ok) {
                throw new Error(`Server returned HTTP transport fault: ${response.status}`);
            }
            const json: HistoricalTestRecord[] = await response.json();
            setTests(json);
            setLoading(false);
        } catch (err: any) {
            setError(err.message || "Failed to establish a connection to the server database index.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistoryData();
    }, []);

    // --- Deletion Execution Callback ---
    const handleRecordDeletion = async (e: React.MouseEvent, testId: string) => {
        // Stop the click event from bubbling up to the <tr> element (which triggers navigation)
        e.stopPropagation();

        const confirmed = window.confirm(`Are you absolutely sure you want to permanently delete test record ${testId}? This operation cannot be undone.`);
        if (!confirmed) return;

        try {
            const response = await fetch(`http://localhost:8000/api/history/${testId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error("Server rejected the record deletion instruction workflow.");
            }

            // Optimistically remove the item from local state arrays to trigger an instant layout clean repaint
            setTests((prevTests) => prevTests.filter((test) => test.test_id !== testId));
        } catch (err: any) {
            alert(`Deletion failure: ${err.message || "Could not complete operation."}`);
        }
    };

    const filteredTests = tests.filter((test) => {
        const matchId = test.test_id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDate = test.timestamp.toLowerCase().includes(searchQuery.toLowerCase());
        return matchId || matchDate;
    });

    const formatDisplayDate = (isoString: string): string => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return isoString; }
    };

    if (loading) {
        return (
            <div className="bg-dark text-light min-vh-screen d-flex flex-column align-items-center justify-content-center">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <h2 className="h6 font-monospace text-muted">Reading SQLite Logs...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-dark text-light min-vh-screen d-flex align-items-center justify-content-center p-3">
                <div className="card bg-danger p-4 text-center border-0 shadow w-100" style={{ maxWidth: '400px' }}>
                    <h3 className="h5 fw-bold mb-2">History Fetch Error</h3>
                    <p className="small opacity-75 mb-4">{error}</p>
                    <button onClick={() => navigate("/")} className="btn btn-light fw-bold">Return Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-dark text-light min-vh-screen p-4">
            <div className="container-md py-4" style={{ maxWidth: '950px' }}>

                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
                    <div>
                        <h1 className="h3 fw-bold text-light m-0">Assessment Logging History</h1>
                        <p className="text-muted small m-0">Track your structural critical power milestones over time</p>
                    </div>
                    <button onClick={() => navigate("/")} className="btn btn-outline-light rounded-3 fw-bold px-3">
                        ← Main Dashboard
                    </button>
                </div>

                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="🔍 Search log entries by Test ID or target dates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control form-control-lg bg-secondary bg-opacity-20 border-secondary text-light placeholder-muted"
                        style={{ borderRadius: '0.75rem', fontSize: '1rem' }}
                    />
                </div>

                {filteredTests.length === 0 ? (
                    <div className="card bg-secondary bg-opacity-10 border-secondary p-5 text-center" style={{ borderRadius: '1rem' }}>
                        <span className="fs-2 mb-2 d-block">📂</span>
                        <h2 className="h5 fw-bold text-muted">No Test History Profiles Found</h2>
                        <p className="small text-muted mb-4">No entries match your criteria.</p>
                    </div>
                ) : (
                    <div className="card bg-secondary bg-gradient border-secondary shadow-lg overflow-hidden" style={{ borderRadius: '1rem' }}>
                        <div className="table-responsive">
                            <table className="table table-dark table-hover align-middle mb-0">
                                <thead className="table-light text-uppercase tracking-wider small">
                                <tr>
                                    <th className="ps-4 py-3">Date & Time</th>
                                    <th className="py-3">Test Type</th>
                                    <th className="py-3 text-center">Critical Force</th>
                                    <th className="py-3 text-center">W' (Battery)</th>
                                    <th className="py-3 text-center">R² Fit</th>
                                    <th className="pe-4 py-3 text-end">Actions</th>
                                </tr>
                                </thead>
                                <tbody className="border-top-0">
                                {filteredTests.map((test) => (
                                    <tr
                                        key={test.test_id}
                                        onClick={() => navigate(`/test-results/${test.test_id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className="ps-4 py-3 fw-semibold font-monospace small text-emerald-400">
                                            {formatDisplayDate(test.timestamp)}
                                        </td>
                                        <td className="py-3 small text-muted">7:3 Intermittent</td>
                                        <td className="py-3 text-center fw-bold text-warning font-monospace">
                                            {test.critical_force_kg.toFixed(1)} <span className="small font-sans text-muted">kg</span>
                                        </td>
                                        <td className="py-3 text-center fw-bold text-success font-monospace">
                                            {test.w_prime_joules.toFixed(0)} <span className="small font-sans text-muted">J</span>
                                        </td>
                                        <td className="py-3 text-center font-monospace small">
                        <span className={`badge ${test.r_squared >= 0.95 ? 'bg-success bg-opacity-20 text-success' : 'bg-warning bg-opacity-20 text-warning'}`}>
                          {(test.r_squared * 100).toFixed(1)}%
                        </span>
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <div className="d-inline-flex gap-2">
                                                <button className="btn btn-sm btn-outline-info rounded-pill px-3">
                                                    View
                                                </button>
                                                <button
                                                    onClick={(e) => handleRecordDeletion(e, test.test_id)}
                                                    className="btn btn-sm btn-outline-danger rounded-pill px-2"
                                                    title="Delete this record"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
