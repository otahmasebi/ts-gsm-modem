
/*

/// <reference path="../lib/ambient/serialport.d.ts"/>
import * as SerialPort from "serialport";



this.serialPort = new SerialPort("dev/ttyUSB0", );

*/


import { 
    ModemInterface, 
    PinManager, 
    AtMessageList, 
    AtMessageImplementations, 
    ReportMode, 
    PinState, 
    SimState  
} from "../lib/index";


console.log("zero up");

let serialPath0= "/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.0-port0";


let modemInterface0 = new ModemInterface(serialPath0);

modemInterface0.runAtCommand("ATI\r", output =>{

    console.log("responce 0: ", output);

});

modemInterface0.evtUnsolicitedAtMessage.attach( atMessage =>{

    console.log("unsolicited event 0", atMessage);

});

console.log("deux");

let serialPath2= "/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.2-port0";


let modemInterface2 = new ModemInterface(serialPath2);


modemInterface2.runAtCommand("ATI\r", output =>{

    console.log("responce: 2", output);

});


modemInterface2.evtUnsolicitedAtMessage.attach( atMessage =>{

    console.log("unsolicited event 2", atMessage);

});


