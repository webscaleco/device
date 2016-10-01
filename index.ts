import { Observable, Subject } from 'rxjs/Rx';
import * as config from 'config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';
import { WaterRower } from 'waterrower';

var args = minimist(process.argv.slice(2));

//IoThub requires
//setting up IoT hub to use the  Advanced Message Queuing Protocol 
let clientFromConnectionString = require('azure-iot-device-amqp').clientFromConnectionString;

//Creating a message object to use later 
let Message = require('azure-iot-device').Message;

//We will have multiple devices in simulation passed in the -d argument for device number 
//(ex: waterrower1) 1-12 are currently on IoT hub

//command line arguments
let name = args["n"] || args["name"] || (config.has('name') ? config.get('name') : undefined) || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || (config.has('socketServerUrl') ? config.get('socketServerUrl') : undefined) || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || (config.has('simulationMode') ? config.get('simulationMode') : undefined);
let autoStart = args["a"] || args["auto-start"] || (config.has('autoStart') ? config.get('autoStart') : false);
let device = args["d"];
if (config.has(device)) {
    var deviceConnectionString = config.get(device);
}

let client = clientFromConnectionString(deviceConnectionString);


//we only want a few pieces of data from the S4 monitor
let waterrower = new WaterRower({ datapoints: ['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal'] });

//logging out some stuff for debugging/tracking
console.log(`Using ${name} as rower name.`);
console.log(`Attempting to connect to ${socketServerUrl}`);
if (simulationMode) console.log('This Regatta machine is running in simulation mode.');

//We dont want to do anything unitl we open connection to iothub
client.open(err => {
    if (err) throw (`Error connecting to the Regatta service. Please check your connection. [${err}]`);

    //wire up to the socket server
    var socket = io(socketServerUrl);
    //sending out socket message here ---
    socket.on('connect', () => {
        //send a check-in message so the rower can be added to the list
        socket.send({ message: 'rower-checkin', name: name });
    });

    //here we want to start the waterrower
    //if using autostart set to 150
    if (autoStart) start(150);
    //otherwise use what is coming over sockets
    // Socket message COMING from UI via the API
    socket.on("message", data => {
        if (data.message == 'session-start') start(data.distance);
    });

    //resets the waterrower monitor S4
    //these go to waterrower module with talks to the waterrower S4 to reset
    function start(distance: number) {
        waterrower.reset();
        waterrower.defineDistanceWorkout(distance);
        if (simulationMode) waterrower.startSimulation();
    }

    // Just for showing messagecount in console
    let messageCount = 0;

    //respond to the waterrower sending data
    //subscibing to the datapoints stream
    waterrower.datapoints$.subscribe(() => {
        //this is all just to rewrite the message on the console and rewrite over it
        if (messageCount > 0) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);  // move cursor to beginning of line
        }
        messageCount++;
        process.stdout.write(`Sending message: ${messageCount}`);  // write text

        //We only want to read these four datapoints. 
        let values = waterrower.readDataPoints(['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal']);
        let msg = {
            message: "strokedata",
            name: name,
            ms_distance: values['ms_distance'],
            m_s_total: values['m_s_total'] / 100, //convert cm to m
            m_s_average: values['m_s_average'] / 100, //convert cm to m
            total_kcal: values['total_kcal'] / 1000 //convert to calories
        };

        //send sockets
        socket.send(msg);

        //send via iothub instead of sockets
        let message = new Message(JSON.stringify(JSON.stringify({ deviceId: device, msg })));
        client.sendEvent(message, (err, res) => {
            if (err) console.log(`Error sending to IoT Hub (${err})`);
        });
    });
});