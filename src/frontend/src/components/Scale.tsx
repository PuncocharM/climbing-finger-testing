import React, {useEffect, useState} from "react";
import {config} from "../config.ts";

enum ConnectionStatus {
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

interface TelemetryData {
    weight: number | null;
    status: string;
}

export function Scale({displayMaxWeight, resetWeightRef}: {
    displayMaxWeight: boolean,
    resetWeightRef?: React.RefObject<(() => void) | null>
}) {
    const [weight, setWeight] = useState<number | null>(null);
    const [maxWeight, setMaxWeight] = useState<number | null>(null);
    const [espStatus, setEspStatus] = useState<string>('Unknown');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.disconnected);

    function connect() {
        setConnectionStatus(ConnectionStatus.connecting);
        const ws = new WebSocket(config.webSocketEndpoint);

        ws.onopen = () => setConnectionStatus(ConnectionStatus.connected);

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data: TelemetryData = JSON.parse(event.data);
                setWeight(data.weight);
                setEspStatus(data.status);
                setMaxWeight((prevMax) => (data.weight != null && (prevMax == null || data.weight > prevMax) ? data.weight : prevMax));
            } catch (error) {
                console.error('Failed to parse incoming telemetry payload:', error);
            }
        };

        ws.onclose = () => {
            setConnectionStatus(ConnectionStatus.disconnected);
            window.setTimeout(connect, config.SERVER_RECONNECT_TIMEOUT);
        };

        return ws;
    }

    useEffect(() => {
        const ws = connect();

        return () => {
            if (ws) {
                ws.onclose = null;
                setConnectionStatus(ConnectionStatus.disconnected);
                ws.close();
            }
        }
    }, [])

    function getClassServerConnection() {
        switch (connectionStatus) {
            case ConnectionStatus.connected: return 'text-success bg-dark';
            case ConnectionStatus.disconnected: return 'text-danger bg-dark';
            case ConnectionStatus.connecting: default: return 'text-warning bg-dark';
        }
    }

    function getClassScaleConnection() {
        switch (espStatus) {
            case "connected": return 'text-success bg-dark';
            case "disconnected": return 'text-danger bg-dark';
            case "connecting": default: return 'text-warning bg-dark';
        }
    }


    function resetMaxWeight() {setMaxWeight(null)}

    if (resetWeightRef != null) {
        resetWeightRef.current = resetMaxWeight
    }

    return (
        <div className="bg-black border border-dark rounded-3 p-4 text-center mb-4 shadow-inner">
            <div className="row">
                <div className={displayMaxWeight ? "col-6 border-end border-dark" : "col-12"}>
                  <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Live Weight [kg]</span>
                    <div className="h2 font-monospace fw-bold text-success my-2">{weight ? weight.toFixed(2) : "-"}</div>
                </div>
                {displayMaxWeight && (
                    <div className="col-6">
                        <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Max Weight [kg]</span>
                        <div className="h2 font-monospace fw-bold text-warning my-2">{maxWeight ? maxWeight.toFixed(2) : "-"}</div>
                    </div>
                )}
            </div>
            <hr className="border-secondary my-3"/>
            <div className="row">
                <div className="col-6">
                    <span className={`badge rounded-pill px-3 py-2 ${getClassServerConnection()}`}>Server {connectionStatus}</span>
                </div>
                <div className="col-6">
                    <span className={`badge rounded-pill px-3 py-2 ${getClassScaleConnection()}`}>Scale {espStatus}</span>
                </div>
            </div>
        </div>
    )
}