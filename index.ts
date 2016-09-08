import { Observable, Subject } from 'rxjs/Rx';
import * as config from 'config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';

var args = minimist(process.argv.slice(3));

//IoThub requires
let Message = require('azure-iot-device').Message;
let clientFromConnectionString = require('azure-iot-device-amqp').clientFromConnectionString;

//We will have multiple devices in simulation pass in the -d argument for device number 1-5 are currently on IoT hub
let deviceNumber = args["d"] || args["deviceNumber"] || (config.has('deviceNumber') ? config.get('deviceNumber') : undefined) || '1';
//The registered device 
var myDevice = 'regatta-dev-' + deviceNumber;
//add deviceid to connection string to set client
let client = clientFromConnectionString(process.env.REGATTA_DEVICE_CONNECTIONSTRING + ';DeviceId=' + myDevice;);


import { WaterRower } from 'waterrower';

let waterrower = new WaterRower();

//command line arguments
let name = args["n"] || args["name"] || (config.has('name') ? config.get('name') : undefined) || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || (config.has('socketServerUrl') ? config.get('socketServerUrl') : undefined) || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || (config.has('simulationMode') ? config.get('simulationMode') : undefined);

console.log(`Using ${name} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);

//open connection to iothub
client.open(err => console.log(err ? 'Could not connect: ' + err : 'Client connected'));

//wire up to the socket server
var socket = io(socketServerUrl);
// socket.on("message", data => {
//     if (data.message == 'startrace') {
        waterrower.reset();
        // waterrower.defineDistanceWorkout(data.distance);
        if(simulationMode) waterrower.startSimulation();
//     }
// });
//respond to the waterrower sending data
waterrower.datapoints$.subscribe(() => {
    let msg = {
        message: "strokedata",
        name: name,
        distance: waterrower.readDataPoint('distance'),
        m_s_total: waterrower.readDataPoint('m_s_total')/100, //convert cm to m
        m_s_average: waterrower.readDataPoint('m_s_average')/100, //convert cm to m
        total_kcal: waterrower.readDataPoint('total_kcal')/1000
    };
    console.log(msg);
    socket.send(msg);
    //ISSUE05: send via iothub instead of sockets
    var data = JSON.stringify({ deviceId: myDevice, msg });
    let message = new Message(JSON.stringify(data));
    client.sendEvent(message, printResultFor('send'));

    //for testing
        function printResultFor(op) {
        return function printResult(err, res) {
            if (err) console.log(op + ' error: ' + err.toString());
            if (res) console.log(op + ' status: ' + res.constructor.name);
        };
    }
});