import {useEffect, useState} from "react";
import {config} from "../config.ts";
import axios from "axios";

enum ConnectionStatus {
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

interface TelemetryData {
    current_weight: number | null;
    max_weight: number | null;
    status: string;
}


type Command = 'tare' | 'start' | 'stop'

export function sendCommand(command: Command) {
    axios.post(config.apiEndpoint + "/command/" + command)
        .catch(error => {
            alert("Error sending command " + command + ": " + error)
        })
}

export function sendCalibrate(weight: number) {
    axios.post(
        config.apiEndpoint + "/command/calibrate",
        null,
        {
            'params': {'weight': weight},
        }
    )
        .catch(error => console.log("Error sending command calibrate: " + error))
}

export function resetMaxWeight() {
    axios.post(config.apiEndpoint + "/command/reset_max_weight")
        .catch(e => console.error("Error sending reset max weight command: " + e));
}

export function Scale({displayMaxWeight}: {
    displayMaxWeight: boolean,
}) {
    const [currentWeight, setCurrentWeight] = useState<number | null>(null);
    const [maxWeight, setMaxWeight] = useState<number | null>(null);
    const [espStatus, setEspStatus] = useState<string>('Unknown');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.disconnected);

    const connect = () => {
        setConnectionStatus(ConnectionStatus.connecting);
        const ws = new WebSocket(config.webSocketEndpoint);

        ws.onopen = () => {
            setConnectionStatus(ConnectionStatus.connected);
        }

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data: TelemetryData = JSON.parse(event.data);
                setCurrentWeight(data.current_weight);
                setMaxWeight(data.max_weight);
                setEspStatus(data.status);
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

    const getClassServerConnection = () => {
        switch (connectionStatus) {
            case ConnectionStatus.connected: return 'text-success bg-dark';
            case ConnectionStatus.disconnected: return 'text-danger bg-dark';
            case ConnectionStatus.connecting: default: return 'text-warning bg-dark';
        }
    }

    const getClassScaleConnection = () => {
        switch (espStatus) {
            case "connected": return 'text-success bg-dark';
            case "disconnected": return 'text-danger bg-dark';
            case "connecting": default: return 'text-warning bg-dark';
        }
    }

    return (
        <div className="bg-black border border-dark rounded-3 p-4 text-center mb-4 shadow-inner">
            <div className="row">
                <div className={displayMaxWeight ? "col-6 border-end border-dark" : "col-12"}>
                  <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Live Weight [kg]</span>
                    <div className="h2 font-monospace fw-bold text-success my-2">{currentWeight ? currentWeight.toFixed(2) : "-"}</div>
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
