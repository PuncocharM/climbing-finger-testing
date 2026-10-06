import axios from "axios";
import {config} from "../config.ts";
import {useNavigate} from "react-router";
import "bootstrap/dist/js/bootstrap.bundle.min.js"
import {Scale} from "../components/Scale.tsx";
import React, {useRef} from "react";
import "../../styles/common.scss"

export default function Home(): React.JSX.Element {
  const resetWeightRef = useRef<() => void>(null);
  const navigate = useNavigate();


  const sendCommand = (command: 'tare' | 'start' | 'stop'): void => {
    axios.post(config.apiEndpoint + "/command/" + command)
        .catch(error => {alert("Error sending command " + command + ": " + error)})
  };



  function calibrate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const weight = formData.get("weight");

    axios.post(
        config.apiEndpoint + "/command/calibrate",
        null,
        {
          'params': {'weight': weight},
        }

    )
    .catch(error => console.log("Error sending command calibrate: " + error))

  }

  return (
      <>
        <div className="bg-dark text-light min-vh-screen d-flex align-items-center justify-content-center">
          <div className="card bg-secondary bg-gradient border-secondary shadow-lg p-4 w-100"
               style={{maxWidth: '450px', borderRadius: '1rem'}}>

            <Scale displayMaxWeight={true} resetWeightRef={resetWeightRef}/>

            <div className="row g-2 mb-2">
              <div className="col-4">
                <button onClick={() => sendCommand('tare')}
                        className="btn btn-primary w-100 py-3 fw-bold rounded-3">Tare
                </button>
              </div>
              <div className="col-4">
                <button onClick={() => sendCommand('start')}
                        className="btn btn-success w-100 py-3 fw-bold rounded-3">Start
                </button>
              </div>
              <div className="col-4">
                <button onClick={() => sendCommand('stop')}
                        className="btn btn-danger w-100 py-3 fw-bold rounded-3">Stop
                </button>
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-12">
                <button onClick={() => resetWeightRef.current && resetWeightRef.current()}
                        className="btn btn-outline-light w-100 py-2 fw-bold rounded-3">
                  Reset Max Weight
                </button>
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-6">
                <button
                    onClick={() => navigate("/critical-force")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Run Critical Force Test (repeaters)
                </button>
              </div>
              <div className="col-6">
                <button
                    onClick={() => navigate("/critical-force-sustain")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Run Critical Force Test (sustain)
                </button>
              </div>
              <div className="col-12">
                <button
                    onClick={() => navigate("/history")}
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >View past tests
                </button>
              </div>
              <div className="col-12">
                <button
                    data-bs-toggle="modal" data-bs-target="#calibrateModal"
                    className="btn btn-outline-light w-100 py-2 fw-bold rounded-3"
                >Calibrate
                </button>
              </div>
            </div>

          </div>
        </div>
        <div className="modal fade" id="calibrateModal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Scale Calibration</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <form onSubmit={e => calibrate(e)}>
                  <input type="text" name="weight"/>
                  <button className="btn btn-primary" type="submit">Calibrate</button>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      </>
  );
}
