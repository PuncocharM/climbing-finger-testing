// src/pages/Home.tsx
import React, { useState, useEffect, useRef } from 'react';
import {config} from "../config.ts";
import {useNavigate} from "react-router";
import "../styles/common.scss"

interface TelemetryData {
  weight: number;
  status: string;
}

interface ControlCommand {
  command: 'tare' | 'start' | 'stop';
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export default function Home(): React.JSX.Element {
  const [weight, setWeight] = useState<number>(0.0);
  const [maxWeight, setMaxWeight] = useState<number>(0.0);
  const [espStatus, setEspStatus] = useState<string>('Unknown');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const navigate = useNavigate();


  const connectWebSocket = (): void => {
    setConnectionStatus('connecting');
    const ws = new WebSocket(config.serverUrl);
    wsRef.current = ws;

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
      reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 2000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const sendCommand = (action: 'tare' | 'start' | 'stop'): void => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload: ControlCommand = { command: action };
      wsRef.current.send(JSON.stringify(payload));
    } else {
      alert('Cannot send command: WebSocket is offline.');
    }
  };

  const getBadgeClass = (): string => {
    switch (connectionStatus) {
      case 'connected': return 'bg-success text-white';
      case 'disconnected': return 'bg-danger text-white';
      case 'connecting': default: return 'bg-warning text-dark animate-pulse';
    }
  };

  return (
      <div className="bg-dark text-light min-vh-screen d-flex align-items-center justify-content-center">
        <div className="card bg-secondary bg-gradient border-secondary shadow-lg p-4 w-100" style={{ maxWidth: '450px', borderRadius: '1rem' }}>

          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h4 m-0 fw-bold">Scale Dashboard</h1>
            <span className={`badge rounded-pill px-3 py-2 ${getBadgeClass()}`}>
            {connectionStatus === 'connected' ? 'Server Connected' : connectionStatus === 'disconnected' ? 'Server Disconnected' : 'Connecting...'}
          </span>
          </div>

          <div className="bg-black border border-dark rounded-3 p-4 text-center mb-4 shadow-inner">
            <div className="row">
              <div className="col-6 border-end border-dark">
                <span className="text-uppercase tracking-wider text-muted small fw-bold d-block mb-1">Live Weight</span>
                <div className="h2 font-monospace fw-bold text-success my-2">{weight.toFixed(2)}</div>
              </div>
              <div className="col-6">
                <span className="text-uppercase tracking-wider text-muted small fw-bold d-block mb-1">Max Weight</span>
                <div className="h2 font-monospace fw-bold text-warning my-2">{maxWeight.toFixed(2)}</div>
              </div>
            </div>
            <hr className="border-secondary my-3" />
            <span className="text-muted small d-block">
            ESP32 Status: <strong className="text-light">{espStatus}</strong>
          </span>
          </div>

          <div className="row g-2 mb-2">
            <div className="col-4"><button onClick={() => sendCommand('tare')} className="btn btn-primary w-100 py-3 fw-bold rounded-3">Tare</button></div>
            <div className="col-4"><button onClick={() => sendCommand('start')} className="btn btn-success w-100 py-3 fw-bold rounded-3">Start</button></div>
            <div className="col-4"><button onClick={() => sendCommand('stop')} className="btn btn-danger w-100 py-3 fw-bold rounded-3">Stop</button></div>
          </div>

          <div className="row g-2 mb-2">
            <div className="col-12">
              <button onClick={() => setMaxWeight(0.0)} className="btn btn-outline-light w-100 py-2 fw-bold rounded-3">
                Reset Max Weight
              </button>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-6">
              <button
                  onClick={() => navigate("/critical-force")}
                  className="btn btn-outline-warning w-100 py-2 fw-bold rounded-3"
              >
                🏋️ Run Critical Force Test
              </button>
            </div>
            <div className="col-6">
              <button
                  onClick={() => navigate("/history")}
                  className="btn btn-outline-info w-100 py-2 fw-bold rounded-3"
              >
                📅 View Past History Logs
              </button>
            </div>
          </div>

        </div>
      </div>
  );
}
