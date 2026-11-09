import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import "../../styles/common.scss"
import axios from "axios";
import type {WorkoutSchema} from "../components/workout-commons.ts";
import {config} from "../config.ts";
import {ButtonHome, ErrorCard, LoadingSpinner, PageContainer} from "../components/utilComponents.tsx";

export default function TestingHistory(): React.JSX.Element {
    const navigate = useNavigate();

    const [tests, setTests] = useState<WorkoutSchema[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);


    function fetchPastTests() {
        setLoading(true);
        setError(null);
        axios.get<WorkoutSchema[]>(config.apiEndpoint + "/workouts")
            .then(r => {
                setTests(r.data);
            })
            .catch((e) => {
                setError(e.message || "Failed fetch past tests.");
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        fetchPastTests();
    }, []);

    const handleTestDeletion = async (e: React.MouseEvent, testId: string) => {
        e.stopPropagation();

        const confirmed = window.confirm(`Are you sure you want to permanently delete test record ${testId}? This operation cannot be undone.`);
        if (!confirmed) return;

        axios.delete(`${config.apiEndpoint}/workouts/${testId}`)
            .then(() => {
                fetchPastTests()
            })
            .catch(r => {
                alert(`Deletion failure: ${r.message || "Could not complete operation."}`);
            })
    };

    const filteredTests = tests.filter((test) => {
        const matchId = test.workout_id.toLowerCase().includes(searchQuery.toLowerCase());
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
            <PageContainer>
                <ButtonHome />
                <LoadingSpinner />
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <ButtonHome/>
                <ErrorCard title="History Fetch Error" error={error} />
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <ButtonHome />

            <div className="container-md py-4" style={{maxWidth: '950px'}}>

                <div
                    className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
                    <h1 className="h3 fw-bold text-light m-0">Test Log History</h1>
                </div>

                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search log entries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control form-control-lg bg-secondary bg-opacity-20 border-secondary text-light placeholder-muted rounded-4"
                        style={{fontSize: '1rem'}}
                    />
                </div>

                {filteredTests.length === 0 ? (
                    <div className="card bg-dark-subtle border-secondary p-5 text-center rounded-4">
                        <span className="fs-2 mb-2 d-block">📂</span>
                        <h2 className="h5 fw-bold text-muted">No Test History Profiles Found</h2>
                        <p className="small text-muted mb-4">No entries match your criteria.</p>
                    </div>
                ) : (
                    <div className="card bg-secondary bg-gradient border-secondary shadow-lg overflow-hidden"
                         style={{borderRadius: '1rem'}}>
                        <div className="table-responsive">
                            <table className="table table-dark table-hover align-middle mb-0">
                                <thead className="table-light text-uppercase tracking-wider small">
                                <tr>
                                    <th className="ps-4 py-3">Date & Time</th>
                                    <th className="py-3 text-center">Test Id</th>
                                    <th className="py-3 text-center">Test type</th>
                                    <th className="py-3 text-center">Test arm</th>
                                    <th className="pe-4 py-3 text-end">Actions</th>
                                </tr>
                                </thead>
                                <tbody className="border-top-0">
                                {filteredTests.map((workout) => (
                                    <tr
                                        key={workout.workout_id}
                                    >
                                        <td className="ps-4 py-3 fw-semibold font-monospace small text-emerald-400">
                                            {formatDisplayDate(workout.timestamp)}
                                        </td>
                                        <td className="py-3 text-center fw-bold text-warning font-monospace">
                                            {workout.workout_id}
                                        </td>
                                        <td className="py-3 text-center font-monospace small">
                                            {workout.workout_type.replaceAll("_", " ")}
                                        </td>
                                        <td className="py-3 text-center fw-bold text-success font-monospace">
                                            {workout.workout_arm}
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <div className="d-inline-flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/test-results/${workout.workout_id}`)}
                                                    className="btn btn-sm btn-outline-info rounded-pill px-3"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={(e) => handleTestDeletion(e, workout.workout_id)}
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
        </PageContainer>
    );
}
