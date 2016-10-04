import { Observable, Subject } from 'rxjs/Rx';
import * as config from 'config';
import * as minimist from 'minimist';
import * as io from 'socket.io-client';
import { WaterRower } from 'waterrower';
import * as azureIotDevice from 'azure-iot-device';
import * as azureIotDeviceAmqp from 'azure-iot-device-amqp';

enum LogLevel { Debug, Information, Warning, Error, Fatal }
let logLevel: LogLevel = LogLevel.Information;

//command line arguments
let args = minimist(process.argv.slice(2));
let name = args["n"] || args["name"] || (config.has('name') ? config.get('name') : undefined) || 'Rower';
let socketServerUrl = args["s"] || args["socket-server-url"] || (config.has('socketServerUrl') ? config.get('socketServerUrl') : undefined) || 'http://localhost:8080';
let simulationMode = args["m"] || args["simulation-mode"] || (config.has('simulationMode') ? config.get('simulationMode') : undefined);
let autoStart = args["a"] || args["auto-start"] || (config.has('autoStart') ? config.get('autoStart') : false);
let device = args["d"] || args["device"] || (config.has('device') ? config.get('device') : undefined);

//setup iothub 
//  value of device parameter determines which configured connection string to use (ex: waterrower1)
let deviceConnectionString = config.get(device).toString();
let Message = azureIotDevice.Message;
let clientFromConnectionString = azureIotDeviceAmqp.clientFromConnectionString;
let client = clientFromConnectionString(deviceConnectionString);

//create waterrower
let waterrower = new WaterRower({ datapoints: ['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal'] });

log(`Using ${name} as rower name.`);
log(`Attempting to connect to ${socketServerUrl}`);
if (simulationMode) log('This Regatta machine is running in simulation mode.');

//wire up to the socket server
var socket = io(socketServerUrl);
socket.on('connect', () => {
    //send a check-in message so the rower can be added to the list
    socket.send({ message: 'rower-checkin', name: name });
});

//when we get an incoming socket message...
socket.on("message", data => {

    //if it's a session-start then start the rower
    if (data.message == 'session-start') start(data.distance);
});

if (autoStart) start(150);

//start the rower
function start(distance: number) {
    waterrower.reset();
    waterrower.defineDistanceWorkout(distance);
    if (simulationMode) waterrower.startSimulation();
}

//open connection to iothub
client.open(err => {
    if (err) throw (`Error connecting to the Regatta service. Please check your connection. [${err}]`);

    //subscribe to the waterrower datapoints stream
    waterrower.datapoints$.subscribe(() => {
        //we're only interested in four datapoints
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
        let message = new Message(JSON.stringify({ deviceId: device, msg }));
        client.sendEvent(message, (err, res) => {
            if (err) log(`Error sending to IoT Hub (${err})`, LogLevel.Error);
        });

        log(`Sent ${JSON.stringify(msg)}`, LogLevel.Debug);
    });
});

function log(msg: string, level: LogLevel = LogLevel.Information) {
    if (level >= logLevel) console.log(msg);
}