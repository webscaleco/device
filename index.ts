import { Observable, Subject } from 'rxjs/Rx';
import * as config from 'config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';

var args = minimist(process.argv.slice(2));

//IoThub requires
let Message = require('azure-iot-device').Message;
let clientFromConnectionString = require('azure-iot-device-amqp').clientFromConnectionString;

//We will have multiple devices in simulation passed in the -d argument for device number (ex: waterrower1) 1-12 are currently on IoT hub
let device = args["d"];
if (config.has(device)) {
    var deviceConnectionString = config.get(device);
}

let client = clientFromConnectionString(deviceConnectionString);

import { WaterRower } from 'waterrower';

let waterrower = new WaterRower({ datapoints: ['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal'] });

//command line arguments
let name = args["n"] || args["name"] || (config.has('name') ? config.get('name') : undefined) || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || (config.has('socketServerUrl') ? config.get('socketServerUrl') : undefined) || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || (config.has('simulationMode') ? config.get('simulationMode') : undefined);
let autoStart = args["a"] || args["auto-start"] || (config.has('autoStart') ? config.get('autoStart') : false);

console.log(`Using ${name} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);
if (simulationMode) console.log('This Regatta machine is running in simulation mode.');

//wire up to the socket server
var socket = io(socketServerUrl);
socket.on('connect', () => {
    //send a check-in message so the rower can be added to the list
    socket.send({ message: 'rower-checkin', name: name });
});

if (autoStart) start(150);

socket.on("message", data => {
    if (data.message == 'session-start') start(data.distance);
});

function start(distance:number) {
    waterrower.reset();
    waterrower.defineDistanceWorkout(distance);
    if (simulationMode) waterrower.startSimulation();
}

let messageCount = 0;
//respond to the waterrower sending data
waterrower.datapoints$.subscribe(() => {
    if (messageCount > 0) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);  // move cursor to beginning of line
    }
    messageCount++;

    let values = waterrower.readDataPoints(['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal']);
    let msg = {
        message: "strokedata",
        name: name,
        ms_distance: values['ms_distance'],
        m_s_total: values['m_s_total'] / 100, //convert cm to m
        m_s_average: values['m_s_average'] / 100, //convert cm to m
        total_kcal: values['total_kcal'] / 1000 //convert to calories
    };
    process.stdout.write(`Messages sent: ${messageCount}`);  // write text
    socket.send(msg);
});