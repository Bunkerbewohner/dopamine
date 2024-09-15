import styles from './Model.module.css';
import {useEffect, useState} from "react";
import {
    Area,
    CartesianGrid,
    ComposedChart, Legend,
    Line, ReferenceLine,
    ResponsiveContainer,
    Tooltip, XAxis,
    YAxis
} from "recharts";

const SimulationSpeed = 60;
const MaxDataLength = 2 * 24 * 60;
const DopamineReserveRefillPerMinuteInPercent = 0.1;
const DopamineBaseTurnOverPerMinuteInPercent = 0.05; // should be smaller than refill rate

interface ActivityDefinition {
    label: string;
    duration: number;
    factor: number;
}

const ACTIVITIES = {
    sleep: {
        label: "Sleep",
        duration: 60 * 8,
        factor: -0.75, // sleep replenishes reserve quicker
    },
    work: {
        label: "Work",
        duration: 60 * 8,
        factor: 1.5
    },
    play: {
        label: "Play",
        duration: 60 * 2,
        factor: 2.0
    },
    amphetamine: {
        label: "Take Amphetamine",
        duration: 1,
        factor: 10.0
    },
    chocolate: {
        label: "Eat Chocolate",
        duration: 5,
        factor: 1.5
    },
    sex: {
        label: "Sex",
        duration: 30,
        factor: 2.0
    },
    excercise: {
        label: "Excercise",
        duration: 30,
        factor: 2.0
    },
    smoke: {
        label: "Smoke",
        duration: 5,
        factor: 2.5
    }
}

type Activity = keyof typeof ACTIVITIES;

interface DataPoint {
    minuteSinceStart: number;
    daytime: string;
    dopamineLevel: number; // amount of dopamine used in this minute, unspecified unit and range
    reservePercent: number;
    activities: Activity[];
}

function dopamineTurnover(activity: Activity, t: number): number {
    // Partially sourced from https://youtu.be/QmOF0crdyRU?t=2408
    const baseline = DopamineBaseTurnOverPerMinuteInPercent;
    const factor = ACTIVITIES[activity].factor;

    // TODO: Factor in time

    return baseline * factor;
}

function totalDopamineUse(activities: Activity[], t: number): number {
    return DopamineBaseTurnOverPerMinuteInPercent + activities.map(activity => dopamineTurnover(activity, 0)).reduce((a, b) => a + b, 0);
}

interface ActivitySwitchProps {
    key?: string;
    activity: Activity;
    active: boolean;
    onToggle: (activity: Activity, value: boolean) => void;
    availableDopamineReseve: number;
}

function ActivitySwitch(props: ActivitySwitchProps) {
    const definition = ACTIVITIES[props.activity];
    const classNames = [styles.ActivitySwitch];
    if (props.active) {
        classNames.push(styles.ActivitySwitchActive);
    }

    const onClick = () => {
        const newState = !props.active;
        props.onToggle(props.activity, newState);

        if (newState) {
            // automatically disable again after default duration
            setTimeout(() => {
                props.onToggle(props.activity, false);
            }, definition.duration * 1000);
        }
    }

    return <button onClick={onClick} disabled={props.availableDopamineReseve < 1} className={classNames.join(' ')}>{definition.label}</button>
}

function CustomTooltip({active, payload, label}: any) {
    if (!active || !payload) return;

    return (
        <div className={styles.CustomTooltip}>
            <p>{`Time: ${label}`}</p>
            <p>{`Reserve: ${payload[0].value.toFixed(2)}`}%</p>
            <p>{`Turnover: ${payload[1].value.toFixed(2)}`}</p>
        </div>
    );
}

function CustomTick({x, y, stroke, payload}: any) {
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-35)">
                {payload.value}
            </text>
        </g>
    );
}

function minuteSinceStartToDaytime(minuteSinceStart: number): string {
    const minuteOfDay = minuteSinceStart % (24 * 60);
    const daytimeHour = Math.floor(minuteOfDay / 60);
    const minuteOfDayInHour = minuteOfDay % 60;
    return `${daytimeHour}:${minuteOfDayInHour < 10 ? '0' : ''}${minuteOfDayInHour}`;
}

const initialData: DataPoint[] = Object.keys([...Array(MaxDataLength)]).map((_, i) => ({
    minuteSinceStart: i,
    daytime: minuteSinceStartToDaytime(i),
    dopamineLevel: DopamineBaseTurnOverPerMinuteInPercent,
    reservePercent: 50,
    activities: []
}));

/**
 * Show a graphical model representing how dopamine works in the brain, with a reserve and use of the dopamin.
 * There are buttons for different activities and clicking them will use up dopamine. Dopamin refills gradually over time.
 * Different activities use different amounts of dopamine. There should be a graph showing the dopamine level over time.
 * The user can also take a pill to refill the dopamine instantly.
 */
export default function Model() {
    const [pool, setPool] = useState(50);
    const [data, setData] = useState<DataPoint[]>(initialData);
    const [activities, setActivities] = useState<Activity[]>([]);
    const currentDopamineUse = totalDopamineUse(activities, 0);
    const currentDopamineDiff = DopamineReserveRefillPerMinuteInPercent - currentDopamineUse;
    const [expanded, setExpanded] = useState(false);
    const currentMinute = data[data.length - 1].minuteSinceStart;
    const midnightMarks = data.filter(data => data.minuteSinceStart % (24 * 60) === 0).map(data => (currentMinute + data.minuteSinceStart) % (24*60));

    useEffect(() => {
        const interval = setInterval(() => {
            const dopamineNeed = totalDopamineUse(activities, 0);
            const dopamineDiff = DopamineReserveRefillPerMinuteInPercent - dopamineNeed;

            const newPool = Math.max(0, Math.min(100, pool + dopamineDiff));
            setPool(newPool);

            const minuteSinceStart = data[data.length - 1].minuteSinceStart + 1;

            const newData = [
                ...data,
                {
                    minuteSinceStart: minuteSinceStart,
                    daytime: minuteSinceStartToDaytime(minuteSinceStart),
                    dopamineLevel: dopamineNeed,
                    reservePercent: newPool,
                    activities: activities
                }
            ];

            if (newData.length > 2 * 24 * 60) {
                newData.shift();
            }

            setData(newData);
        }, 1000 / SimulationSpeed);

        return () => clearInterval(interval);
    });

    const onActivityToggle = (activity: Activity, value: boolean) => {
        if (value) {
            setActivities([...activities, activity]);
        } else {
            setActivities(activities.filter(a => a !== activity));
        }
    }

    return <div className={styles.Model}>

        <div className={styles.Chart}>

            <div className={styles.DopamineChart}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data}>
                        {/*<CartesianGrid strokeDasharray="3 3"/>*/}
                        <YAxis yAxisId={1} dataKey={'reservePercent'} domain={[0, 100]}/>
                        <YAxis yAxisId={2} dataKey={'dopamineLevel'} orientation={'right'} domain={[0, 1]}/>
                        <XAxis type={'category'} minTickGap={50} dataKey={'daytime'} domain={[0, 24 * 60]} interval={'preserveEnd'} angle={45}/>
                        <Area type={'natural'} dataKey={'reservePercent'} fill={'rgba(0,255,157,0.58)'}
                              stroke='#00ff9d' yAxisId={1} dot={false} isAnimationActive={false}/>
                        <Line type={'monotone'} dataKey={'dopamineLevel'} stroke={'#7c74bd'} yAxisId={2}
                              strokeWidth={2} dot={false} isAnimationActive={false}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend height={36} verticalAlign={'top'}/>
                        <ReferenceLine x={2*24*60 - Math.abs(currentMinute % (1*24*60))} stroke='green' yAxisId={1} strokeDasharray="3 3"/>
                        <ReferenceLine x={1*24*60 - Math.abs(currentMinute % (1*24*60))} stroke='green' yAxisId={1} strokeDasharray="3 3"/>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className={styles.ReserveChart}>
                <label className={styles.ProgressBarLabel}>Dopamine Reserve</label>
                <div className={styles.ProgressBar}>
                    <div className={[styles.DopamineBar].join(' ')} style={{width: `${pool}%`}}>
                        <div className={styles.ProgressBarValue}>
                            <div>{pool.toFixed(1)}%</div>
                            <div>{currentDopamineDiff > 0 ? '+' : ''}{currentDopamineDiff.toFixed(1)}%/m</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.Actions}>
                {Object.keys(ACTIVITIES).map(activity => (
                    <ActivitySwitch key={activity}
                                    activity={activity as Activity}
                                    active={activities.indexOf(activity) >= 0}
                                    availableDopamineReseve={pool}
                                    onToggle={onActivityToggle}/>))}
            </div>
        </div>

    </div>;
}

/**
 * TODOS
 * - disable activities when dopamine runs out
 */
