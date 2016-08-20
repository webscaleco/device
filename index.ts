import { Observable, Subject} from 'rxjs/Rx';
import config from './config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';

var args = minimist(process.argv.slice(2));
import { WaterRower } from 'waterrower';

let waterrower = new WaterRower();

//command line arguments
let name = args["n"] || args["name"] || config.name || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || config.socketServerUrl || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || config.simulationMode;

console.log(`Using ${name} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);

//wire up to the socket server
var socket = io(socketServerUrl);
socket.on("message", data => {
    if (data.message == 'startrace') {
        waterrower.reset();
        waterrower.defineDistanceWorkout(data.distance);
        if(simulationMode) waterrower.startSimulation();
    }
});

//respond to the waterrower sending data
waterrower.datapoints$.subscribe(() => {
    socket.send({
        message: "strokedata",
        name: name,
        distance: waterrower.requestDataPoint('distance'),
        strokeRate: waterrower.requestDataPoint('strokes_cnt'),
        speed: waterrower.requestDataPoint('m_s_total'),
        clock: waterrower.requestDataPoint('display_sec')
    });
});