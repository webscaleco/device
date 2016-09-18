import { Observable, Subject } from 'rxjs/Rx';
import * as config from 'config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';

var args = minimist(process.argv.slice(2));
import { WaterRower } from 'waterrower';

let waterrower = new WaterRower({ datapoints: ['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal'] });

//command line arguments
let name = args["n"] || args["name"] || (config.has('name') ? config.get('name') : undefined) || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || (config.has('socketServerUrl') ? config.get('socketServerUrl') : undefined) || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || (config.has('simulationMode') ? config.get('simulationMode') : undefined);

console.log(`Using ${name} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);
if (simulationMode) console.log('This Regatta machine is running in simulation mode.');

//wire up to the socket server
var socket = io(socketServerUrl);
socket.on('connect', () => {
    //send a check-in message so the rower can be added to the list
    socket.send({ message: 'rower-checkin', name: name });
});

socket.on("message", data => {
    if (data.message == 'session-start') {
        waterrower.reset();
        waterrower.defineDistanceWorkout(data.distance);
        if (simulationMode) waterrower.startSimulation();
    }
});

//respond to the waterrower sending data
waterrower.datapoints$.subscribe(() => {
    let values = waterrower.readDataPoints(['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal']);
    let msg = {
        message: "strokedata",
        name: name,
        ms_distance: values['ms_distance'],
        m_s_total: values['m_s_total'] / 100, //convert cm to m
        m_s_average: values['m_s_average'] / 100, //convert cm to m
        total_kcal: values['total_kcal'] / 1000 //convert to calories
    };
    console.log(msg);
    socket.send(msg);
});