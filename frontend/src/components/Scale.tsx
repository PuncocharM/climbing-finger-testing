import React, {useEffect, useState} from "react";
import {config} from "../config.ts";

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface TelemetryData {
    weight: number;
    status: string;
}

export function Scale({displayMaxWeight, resetWeightRef}: {
    displayMaxWeight: boolean,
    resetWeightRef?: React.RefObject<(() => void) | null>
}) {
    const [weight, setWeight] = useState<number>(0.0);
    const [maxWeight, setMaxWeight] = useState<number>(0.0);
    const [espStatus, setEspStatus] = useState<string>('Unknown');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

    function connect() {
        setConnectionStatus('connecting');
        const ws = new WebSocket(config.webSocketEndpoint);

        ws.onopen = () => setConnectionStatus('connected');

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data: TelemetryData = JSON.parse(event.data);
                setWeight(data.weight);
                setEspStatus(data.status);
                setMaxWeight((prevMax) => (data.weight > prevMax ? data.weight : prevMax));
            } catch (error) {
                console.error('Failed to parse incoming telemetry payload:', error);
            }
        };

        ws.onclose = () => {
            setConnectionStatus('disconnected');
            window.setTimeout(connect, 1000);
        };

        return ws;
    }

    useEffect(() => {
        const ws = connect();

        return () => {
            if (ws) {
                ws.onclose = null;
                setConnectionStatus('disconnected');
                ws.close();
            }
        }
    }, [])

    function getBadgeClass() {
        switch (connectionStatus) {
            case 'connected': return 'text-success bg-dark';
            case 'disconnected': return 'text-danger bg-dark';
            case 'connecting': default: return 'text-warning bg-dark';
        }
    }

    function resetMaxWeight() {setMaxWeight(0)}

    if (resetWeightRef != null) {
        resetWeightRef.current = resetMaxWeight
    }

    return (
        <div className="bg-black border border-dark rounded-3 p-4 text-center mb-4 shadow-inner">
            <div className="row">
                <div className={displayMaxWeight ? "col-6 border-end border-dark" : "col-12"}>
                  <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Live Weight</span>
                    <div className="h2 font-monospace fw-bold text-success my-2">{weight.toFixed(2)}</div>
                </div>
                {displayMaxWeight && (
                    <div className="col-6">
                        <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Max Weight</span>
                        <div className="h2 font-monospace fw-bold text-warning my-2">{maxWeight.toFixed(2)}</div>
                    </div>
                )}
            </div>
            <hr className="border-secondary my-3"/>
            <div className="row">
                <div className="col-6">
                                    <span className={`badge rounded-pill px-3 py-2 ${getBadgeClass()}`}>
                    {connectionStatus === 'connected' ? 'Server Connected' : connectionStatus === 'disconnected' ? 'Server Disconnected' : 'Connecting...'}
                </span>
                </div>
                <div className="col-6">
                    <span className="badge rounded-pill bg-dark px-3 py-2 text-light fw-normal small d-block">ESP32 Status: <strong className="text-light">{espStatus}</strong></span>
                </div>
            </div>
        </div>
    )

    // return {'weight': weight, 'maxWeight': maxWeight, 'espStatus': espStatus, 'connectionStatus': connectionStatus, 'resetMaxWeight': resetMaxWeight};
}