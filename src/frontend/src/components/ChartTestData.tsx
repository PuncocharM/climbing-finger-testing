import React, {useMemo} from "react";
import {Line} from "react-chartjs-2";
import {
    Chart as ChartJS, type ChartData, type ChartOptions, type Plugin,
    Decimation,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import {type TestEventSchema, TestPhaseEvent, type ScaleData} from "./test-commons.ts";


ChartJS.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Tooltip,
    Legend,
    Decimation,
    zoomPlugin,
);

interface Band {
    start: number;
    end: number;
    color: string;
}


function parseTs(ts: string) {
    // if no time zone, treat as UTC
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
    return Date.parse(hasTz ? ts : `${ts}Z`)
}

const PULL_COLOR = 'rgba(239, 68, 68, 0.15)';
const REST_COLOR = 'rgba(59, 130, 246, 0.1)';

function buildBands(events: TestEventSchema[], t0: number): Band[] {
    const sortedEvents = events
        .map(e => ({t: (parseTs(e.timestamp) - t0) / 1000, type: e.event_type}))
        .sort((a, b) => a.t - b.t);


    const bands: Band[] = [];
    for (let i = 0; i < sortedEvents.length - 1; i++) {
        const e1 = sortedEvents[i];
        const e2 = sortedEvents[i + 1];
        if (e1.type == TestPhaseEvent.PULL_START || e1.type == TestPhaseEvent.REST_START) {
            bands.push({
                start: e1.t,
                end: e2.t,
                color: e1.type == TestPhaseEvent.PULL_START ? PULL_COLOR : REST_COLOR,
            });
        }
    }


    return bands;
}


const CHART_TEXT_COLOR = 'rgba(0, 0, 0, 0.85)';
const CHART_GRID_COLOR = 'rgba(0, 0, 0, 0.12)';

const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,       // data is already in {x, y} form (required for decimation)
    normalized: true,
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
    },
    scales: {
        x: {
            type: 'linear',
            title: {display: true, text: 'Time [s]', color: CHART_TEXT_COLOR},
            ticks: {color: CHART_TEXT_COLOR},
            grid: {color: CHART_GRID_COLOR},
        },
        y: {
            title: {display: true, text: 'Weight [kg]', color: CHART_TEXT_COLOR},
            ticks: {color: CHART_TEXT_COLOR},
            grid: {color: CHART_GRID_COLOR},
        },
    },
    plugins: {
        legend: {labels: {color: CHART_TEXT_COLOR}, display: false},
        decimation: {enabled: true, algorithm: 'min-max'},
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            callbacks: {
                // title: (items) =>
                //     items.length ? `t = ${(items[0].parsed.x as number).toFixed(2)} s` : '',
                title: (_) => "",
                label: (item) =>
                    ` ${(item.parsed.y as number).toFixed(2)} kg`,
                // `${item.dataset.label}: ${(item.parsed.y as number).toFixed(2)}`,
            },
        },
        zoom: {
            // drag to scroll horizontally, wheel / pinch to zoom the time axis
            pan: {enabled: true, mode: 'x'},
            zoom: {
                wheel: {enabled: true},
                pinch: {enabled: true},
                mode: 'x',
            },
            limits: {
                x: {min: 'original', max: 'original'},
            },
        },
    },
}

export default function Chart({testEvents, scaleData, chartRef}: {
    testEvents: TestEventSchema[],
    scaleData: ScaleData,
    chartRef?: React.RefObject<ChartJS<"line"> | null>
}) {


    const t0 = useMemo(() => {
        return testEvents.length > 0 ? Math.min(...testEvents.map(te => te.timestamp).map(parseTs)) : 0
    }, [testEvents]);


    const bands = useMemo(() => buildBands(testEvents, t0), [testEvents, t0]);

    const chartData = useMemo<ChartData<'line'>>(() => {
        const ts = scaleData?.timestamps ?? [];
        const xs = ts.map(t => (parseTs(t) - t0) / 1000);

        return {
            datasets: [
                {
                    label: 'Weight',
                    data: xs.map((x, i) => ({x, y: scaleData!.weights[i]})),
                    borderColor: 'rgb(0,0,0)',
                    backgroundColor: 'rgb(0, 0, 0)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHitRadius: 10,
                    tension: 0,
                },
                // {
                //     label: 'Max weight',
                //     data: xs.map((x, i) => ({ x, y: scaleData!.max_weights[i] })),
                //     borderColor: 'rgba(255, 255, 255, 0.55)',
                //     backgroundColor: 'rgba(255, 255, 255, 0.55)',
                //     borderWidth: 1.5,
                //     borderDash: [6, 4],
                //     pointRadius: 0,
                //     pointHoverRadius: 4,
                //     pointHitRadius: 10,
                //     tension: 0,
                // },
            ],
        };
    }, [scaleData, t0]);

    const bandsPlugin = useMemo<Plugin<'line'>>(() => ({
        id: 'phaseBands',
        beforeDatasetsDraw(chart) {
            const {ctx, chartArea, scales} = chart;
            const xScale = scales.x;
            if (!chartArea || !xScale) return;

            ctx.save();
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
            ctx.clip();

            for (const band of bands) {
                const x0 = xScale.getPixelForValue(band.start);
                const x1 = xScale.getPixelForValue(band.end);
                ctx.fillStyle = band.color;
                ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.height);
            }

            ctx.restore();
        },
    }), [bands]);

    return (
        <Line
            ref={chartRef}
            data={chartData}
            options={chartOptions}
            plugins={[bandsPlugin]}
        />
    )
}