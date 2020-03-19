"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var evt_1 = require("evt");
require("colors");
var CardLockFacility = /** @class */ (function () {
    function CardLockFacility(atStack, debug) {
        this.atStack = atStack;
        this.debug = debug;
        this.evtUnlockCodeRequest = new evt_1.Evt();
        this.evtPinStateReady = new evt_1.VoidEvt();
        this.retrieving = true;
        this.unlocking = false;
        this.debug("Initialization");
        this.retrieveCX_CPIN_READ();
    }
    CardLockFacility.prototype.enterPin = function (pin) {
        if (this.pinState !== "SIM PIN")
            throw new Error();
        this.__enterPin__(pin);
    };
    CardLockFacility.prototype.enterPin2 = function (pin2) {
        if (this.pinState !== "SIM PIN2")
            throw new Error();
        this.__enterPin__(pin2);
    };
    CardLockFacility.prototype.enterPuk = function (puk, newPin) {
        if (this.pinState !== "SIM PUK")
            throw new Error();
        this.__enterPuk__(puk, newPin);
    };
    CardLockFacility.prototype.enterPuk2 = function (puk, newPin2) {
        if (this.pinState !== "SIM PUK2")
            throw new Error();
        this.__enterPuk__(puk, newPin2);
    };
    Object.defineProperty(CardLockFacility.prototype, "pinState", {
        get: function () {
            return this.cx_CPIN_READ.pinState;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CardLockFacility.prototype, "times", {
        get: function () { return this.cx_CPIN_READ.times; },
        enumerable: true,
        configurable: true
    });
    CardLockFacility.prototype.retrieveCX_CPIN_READ = function () {
        var _this = this;
        this.retrieving = true;
        this.atStack.runCommand("AT^CPIN?\r").then(function (_a) {
            var resp = _a.resp;
            var resp_t = resp;
            _this.retrieving = false;
            _this.cx_CPIN_READ = resp_t;
            if (_this.pinState === "READY") {
                _this.evtPinStateReady.post();
            }
            else {
                _this.evtUnlockCodeRequest.post({
                    "pinState": _this.pinState,
                    "times": _this.times
                });
            }
        });
    };
    CardLockFacility.prototype.__enterPin__ = function (pin) {
        var _this = this;
        if (this.retrieving)
            throw new Error();
        if (this.unlocking)
            throw new Error();
        if (!pin.match(/^[0-9]{4}$/))
            throw new Error();
        this.unlocking = true;
        this.atStack.runCommand("AT+CPIN=" + pin + "\r", {
            "recoverable": true,
        }).then(function (_a) {
            var final = _a.final;
            _this.unlocking = false;
            if (!final.isError) {
                return _this.evtPinStateReady.post();
            }
            _this.retrieveCX_CPIN_READ();
        });
    };
    CardLockFacility.prototype.__enterPuk__ = function (puk, newPin) {
        var _this = this;
        if (this.retrieving)
            throw new Error();
        if (this.unlocking)
            throw new Error();
        if (!puk.match(/^[0-9]{8}$/))
            throw new Error();
        if (!newPin.match(/^[0-9]{4}$/))
            throw new Error();
        this.unlocking = true;
        this.atStack.runCommand("AT+CPIN=" + puk + "," + newPin + "\r", { "recoverable": true, }).then(function (_a) {
            var final = _a.final;
            _this.unlocking = false;
            if (!final.isError) {
                return _this.evtPinStateReady.post();
            }
            _this.retrieveCX_CPIN_READ();
        });
    };
    return CardLockFacility;
}());
exports.CardLockFacility = CardLockFacility;
