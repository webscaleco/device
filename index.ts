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
        ms_distance: waterrower.readDataPoint('ms_distance'),
        m_s_total: waterrower.readDataPoint('m_s_total')/100, //convert cm to m
        m_s_average: waterrower.readDataPoint('m_s_average')/100, //convert cm to m
        total_kcal: waterrower.readDataPoint('total_kcal')/1000
    };
    console.log(msg);
    socket.send(msg);
    //ISSUE05: send via iothub instead of sockets
});