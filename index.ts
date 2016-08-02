import { Observable, Subject} from 'rxjs/Rx';
import config from './config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';

var args = minimist(process.argv.slice(2));
import { WaterRower } from 'waterrower';

let waterrower = new WaterRower();

//command line arguments
let rowerName = (args["n"] ? args["n"] : (config.name ? config.name : 'Rower'));
let socketServerUrl = (args["s"] ? args["s"] : (config.socketServerUrl ? config.socketServerUrl : 'http://localhost:8080'));

console.log(`Using ${rowerName} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);

//wire up to the socket server
var socket = io(socketServerUrl);
socket.on("message", data => {
    if (data.message == 'startrace') {
        waterrower.reset();
        waterrower.defineDistanceWorkout(data.distance);
    }
});

//respond to the waterrower sending data
waterrower.datapoints$.subscribe(() => {
    socket.send({
        message: "strokedata",
        name: rowerName,
        distance: waterrower.requestDataPoint('distance'),
        strokeRate: waterrower.requestDataPoint('strokes_cnt'),
        speed: waterrower.requestDataPoint('m_s_total'),
        clock: waterrower.requestDataPoint('display_sec')
    });
});