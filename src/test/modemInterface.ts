/*Example for reading received SMS as PDU.*/

import { ModemInterface, AtMessageId, AtMessageImplementations } from "../lib/index";

console.log("Now send a SMS to your GSM modem");

//Here put the serial port for at command of your modem (e.g. /dev/ttyUSB2)
let modemInterface = new ModemInterface("/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.2-port0");

modemInterface.evtError.attach(error => {throw error;});

//Tell the modem to alert when there is a new SMS.
modemInterface.runAtCommand("AT+CNMI=2,1,0,0,0\r");

modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

    //Reception of a new SMS
    if (atMessage.id === AtMessageId.CMTI) {

        let atMessageCMTI = <AtMessageImplementations.CMTI>atMessage;

        //Reading the received SMS from memory
        modemInterface.runAtCommand(`AT+CMGR=${atMessageCMTI.index}\r`, output => {

            let atMessageCMGR= <AtMessageImplementations.CMGR>output.atMessage;

            console.log("new message received: ", atMessageCMGR);

            //Now the PDU have to be parsed, for example with garronej/node-python-messaging

            process.exit(0);

        });

    }

});
