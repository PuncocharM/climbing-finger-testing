import React, {useEffect, useState} from "react";
import {config} from "../config.ts";
import axios from "axios";

enum ConnectionStatus {
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
}

interface StreamData {
    timestamp: string | null;
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


function TargetWeightSlider({currentWeight, targetWeight}: {
    currentWeight: number,
    targetWeight: number
}) {
    const margin = targetWeight * 0.05;
    const axisMin = Math.min(targetWeight * 0.75, currentWeight - margin);
    const axisMax = Math.max(targetWeight * 1.25, currentWeight + margin);
    const axisSpan = axisMax - axisMin;

    const toPercent = (value: number) =>
        Math.min(100, Math.max(0, ((value - axisMin) / axisSpan) * 100));

    const targetPos = toPercent(targetWeight);
    const currentPos = toPercent(currentWeight);

    const diff = currentWeight - targetWeight;
    const onTarget = Math.abs(diff) <= targetWeight * config.TARGET_WEIGHT_TOLERANCE;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => axisMin + f * axisSpan);

    const bootstrapColor = onTarget ? 'success' : diff > 0 ? 'danger' : 'warning';

    const arrowBaseStyle: React.CSSProperties = {
        position: 'absolute',
        transform: 'translateX(-50%)',
        fontSize: '1.4rem',
        lineHeight: 1,
    };

    return (
        <div className="mt-3 mb-2 px-3">
            {/* Upper arrow */}
            <div style={{position: 'relative', height: '3.2rem'}}>
                <div className="text-info text-center"
                     style={{...arrowBaseStyle, left: `${targetPos}%`, bottom: 0, transition: 'left 0.2s linear'}}>
                    <div className="small fw-bold text-uppercase" style={{fontSize: '0.65rem'}}>
                        Target {targetWeight.toFixed(2)}
                    </div>
                    <div>▼</div>
                </div>
            </div>

            {/* Axis */}
            <div className="position-relative rounded-pill bg-secondary" style={{height: '8px'}}>
                <div
                    className={`rounded-pill bg-${bootstrapColor}`}
                    style={{
                        width: `${currentPos}%`,
                        height: '100%',
                        transition: 'width 0.2s linear',
                    }}
                />
                <div
                    className="bg-info"
                    style={{
                        position: 'absolute',
                        left: `${targetPos}%`,
                        top: '-4px',
                        width: '2px',
                        height: '16px',
                        transform: 'translateX(-50%)',
                        transition: 'left 0.2s linear',
                    }}
                />
            </div>

            {/* Tick labels */}
            <div style={{position: 'relative', height: '1.2rem'}} className="mt-1">
                {ticks.map((t, i) => (
                    <span key={i}
                          className="text-light small font-monospace"
                          style={{
                              position: 'absolute',
                              left: `${toPercent(t)}%`,
                              transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                              fontSize: '0.7rem',
                          }}>
                        {t.toFixed(2)}
                    </span>
                ))}
            </div>

            {/* Lower arrow */}
            <div style={{position: 'relative', height: '3.2rem'}}>
                <div className={`text-${bootstrapColor} text-center`}
                     style={{
                         ...arrowBaseStyle,
                         left: `${currentPos}%`,
                         top: 0,
                         transition: 'left 0.2s linear',
                     }}>
                    <div>▲</div>
                    <div className="small fw-bold text-uppercase" style={{fontSize: '0.65rem'}}>
                        {currentWeight.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function Scale({displayMaxWeight, targetWeight}: {
    displayMaxWeight: boolean,
    targetWeight?: number | null
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
                const data: StreamData = JSON.parse(event.data);
                setCurrentWeight(data.current_weight);
                setMaxWeight(data.max_weight);
                setEspStatus(data.status);
                // const timestamp = data.timestamp && Date.parse(data.timestamp)
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

    const showSlider = currentWeight != null && targetWeight != null && targetWeight > 0;
    const diff = (currentWeight == null || targetWeight == null) ? 0 : currentWeight - targetWeight;
    const onTarget = (currentWeight == null || targetWeight == null) ? false : Math.abs(diff) <= targetWeight * config.TARGET_WEIGHT_TOLERANCE;

    return (
        <div className="bg-black border border-dark rounded-3 p-4 text-center mb-4 shadow-inner">
            <div className="row">
                <div className={displayMaxWeight ? "col-6 border-end border-dark" : "col-12"}>
                    <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Live Weight [kg]</span>
                    <div className={`h2 font-monospace fw-bold ${!showSlider ? 'text-light' : onTarget ? 'text-success' : diff > 0 ? 'text-danger' : 'text-warning'} my-2`}>{currentWeight !== null ? currentWeight.toFixed(2) : "-"}</div>
                </div>
                {displayMaxWeight && (
                    <div className="col-6">
                        <span className="text-uppercase tracking-wider text-light small fw-bold d-block mb-1">Max Weight [kg]</span>
                        <div className="h2 font-monospace fw-bold text-light my-2">{maxWeight !== null ? maxWeight.toFixed(2) : "-"}</div>
                    </div>
                )}
            </div>
            {showSlider && (
                <>
                    <hr className="border-secondary my-3"/>
                    <TargetWeightSlider currentWeight={currentWeight} targetWeight={targetWeight!}/>
                </>
            )}
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