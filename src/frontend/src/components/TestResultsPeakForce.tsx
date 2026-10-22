import {useEffect, useState} from "react";
import axios from "axios";
import {config} from "../config.ts";
import {ErrorCard, LoadingSpinner} from "./utilComponents.tsx";

interface PeakForceTestResult {
    set_peaks: number[]
    max_force: number
}

export function TestResultsPeakForce({testId}: { testId: string }) {
    const [testResults, setTestResults] = useState<PeakForceTestResult | null>(null)
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        axios.get<PeakForceTestResult>(`${config.apiEndpoint}/test-entries/${testId}/test-results-peak-force`)
            .then(r => {
                setTestResults(r.data)
            })
            .catch(e => {
                setError(e.response?.data?.detail || e.message || "An error occurred.");
            })
            .finally(() => {
                setLoading(false);
            })

    }, [testId])

    if (loading) {
        return <LoadingSpinner />
    }

    if (error || testResults == null) {
        return <ErrorCard title="Failed to load peak force test results" error={error || "Could not retrieve data."} />
    }

    return (
        <div>
            <div>Max force overall: <strong>{testResults.max_force.toFixed(2)} kg</strong></div>
            <div>Max force each set: {testResults.set_peaks.map(w => w.toFixed(2) + " kg").join(" | ")}</div>
        </div>
    )
}