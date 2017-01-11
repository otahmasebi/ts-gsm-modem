import { 
    ModemInterface, 
    PinManager, 
    AtMessageList, 
    AtMessageImplementations, 
    ReportMode, 
    PinState, 
    SimState  
} from "../lib/index";


let serialPath= "/dev/serial/by-path/platform-3f980000.usb-usb-0:1.4:1.2-port0";

let modemInterface = new ModemInterface(serialPath,{
    "reportMode": ReportMode.DEBUG_INFO_CODE
});

modemInterface.evtSerialPortError.attach(serialPortError =>{ throw serialPortError; });
modemInterface.evtParseError.attach(parseError =>{ 
    console.log(parseError);
    throw parseError; 
});

let pinManager = new PinManager(modemInterface);

pinManager.evtRequestCode.attach((request) => {

    console.log("============>evtRequestCode");

    switch (request.pinState) {
        case PinState.SIM_PIN:

            console.log("SIM PIN requested");

            switch (request.times) {
                case 3:
                    console.log("3 try left, entering 0001");
                    pinManager.enterPin("0001");
                    break;
                case 2:
                    console.log("2 try left, entering 1234");
                    pinManager.enterPin("1234");
                    break;
                case 1:
                    console.log("1 try left, entering pin 0000");
                    pinManager.enterPin("0000");
                    break;
                default:
            }

            break;
        case PinState.SIM_PUK:
        
            console.log("sim locked, PUK requested");

            switch(request.times){
                case 10: 
                    console.log("10 try left entering wrong puk 12345678");
                    pinManager.enterPuk("12345678", "0000");
                    break;
                case 9:
                    console.log("9 try left, Finally, entering the true PUK code, 89390485 and set pin to 0001");
                    pinManager.enterPuk("89390485", "0001");
                default:
            }

            break;
        default:
    }

});

pinManager.evtNoSim.attach(() => {

    console.log("==============>evtNoSim");

    process.exit(0);

});

pinManager.evtSimReady.attach(() => {

    console.log("======>evtSimReady");

    modemInterface.runAtCommand("AT+CNUM\r", output => {

        let number = (<AtMessageImplementations.CNUM>(<AtMessageList>output.atMessage).atMessages[0]).number;

        console.log(pinManager.atMessageHuaweiCPIN);
        console.log(pinManager.atMessageHuaweiSYSINFO);
        console.log("sim number: ", number);

        process.exit(0);

    });

});