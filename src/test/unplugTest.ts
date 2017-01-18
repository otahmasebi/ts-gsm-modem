import { 
    ModemInterface, 
    PinManager, 
    AtMessageList, 
    AtMessageImplementations, 
    ReportMode, 
    PinState, 
    SimState  
} from "../lib/index";

import * as promisify from "ts-promisify";


let serialPath= "/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.2-port0";

let modemInterface = new ModemInterface(serialPath,{
    "reportMode": ReportMode.DEBUG_INFO_CODE
});

modemInterface.evtRunAtCommandError.attach(runAtCommandError=>{

    console.log("run at command error", runAtCommandError);

    throw runAtCommandError;

});

console.log("started updated");


(async () => {

    console.log("start ok");

    for (let i in [1, 2, 3, 4, 5, 6, 7]) {

        console.log("tick");

        await promisify.generic((ms, callback) => setTimeout(callback, ms))(2000);



        /*

        try {

            let [output] = await promisify.generic(modemInterface, modemInterface.runAtCommand)("AT\r");

            console.log(output);

        } catch (error) {
            console.log("ici: ", error);
        }
        */

    }

    console.log("end");

    process.exit(0);


})();


