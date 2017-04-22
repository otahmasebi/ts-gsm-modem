"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var at_messages_parser_1 = require("at-messages-parser");
var ts_events_extended_1 = require("ts-events-extended");
var SystemState = (function () {
    function SystemState(atStack) {
        var _this = this;
        this.atStack = atStack;
        this.evtReportSimPresence = new ts_events_extended_1.SyncEvent();
        this.isRoaming = undefined;
        this.evtNetworkReady = new ts_events_extended_1.VoidSyncEvent();
        this.evtValidSim = new ts_events_extended_1.VoidSyncEvent();
        this.atStack.evtUnsolicitedMessage.attach(function (atMessage) { return _this.update(atMessage); });
        this.atStack.runCommand("AT^SYSINFO\r", function (resp) {
            _this.isRoaming = resp.isRoaming;
            _this.evtReportSimPresence.post(resp.simState !== at_messages_parser_1.AtMessage.SimState.NO_SIM);
            _this.update({
                "id": at_messages_parser_1.AtMessage.idDict.CX_SIMST_URC,
                "simState": resp.simState
            });
            _this.update({
                "id": at_messages_parser_1.AtMessage.idDict.CX_SRVST_URC,
                "serviceStatus": resp.serviceStatus
            });
            _this.update({
                "id": at_messages_parser_1.AtMessage.idDict.CX_MODE_URC,
                "sysMode": resp.sysMode
            });
        });
    }
    Object.defineProperty(SystemState.prototype, "isNetworkReady", {
        get: function () {
            return this.isValidSim &&
                this.serviceStatus === at_messages_parser_1.AtMessage.ServiceStatus.VALID_SERVICES &&
                this.sysMode !== at_messages_parser_1.AtMessage.SysMode.NO_SERVICES;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SystemState.prototype, "isValidSim", {
        get: function () {
            return this.simState === at_messages_parser_1.AtMessage.SimState.VALID_SIM;
        },
        enumerable: true,
        configurable: true
    });
    SystemState.prototype.update = function (atMessage) {
        switch (atMessage.id) {
            case at_messages_parser_1.AtMessage.idDict.CX_SIMST_URC:
                var simState = atMessage.simState;
                if (!this.isValidSim) {
                    this.simState = simState;
                    if (this.isValidSim)
                        this.evtValidSim.post();
                }
                else
                    this.simState = simState;
                break;
            case at_messages_parser_1.AtMessage.idDict.CX_SRVST_URC:
                var serviceStatus = atMessage.serviceStatus;
                if (!this.isNetworkReady) {
                    this.serviceStatus = serviceStatus;
                    if (this.isNetworkReady)
                        this.evtNetworkReady.post();
                }
                else
                    this.serviceStatus = serviceStatus;
                break;
            case at_messages_parser_1.AtMessage.idDict.CX_MODE_URC:
                var sysMode = atMessage.sysMode;
                if (!this.isNetworkReady) {
                    this.sysMode = sysMode;
                    if (this.isNetworkReady)
                        this.evtNetworkReady.post();
                }
                else
                    this.sysMode = sysMode;
                break;
            default: return;
        }
        /*
        console.log(JSON.stringify({
            "atMessage": atMessage,
            "isValidSim": this.isValidSim,
            "isNetworkReady": this.isNetworkReady,
            "simState": SimState[this.simState],
            "serviceStatus": ServiceStatus[this.serviceStatus],
            "sysMode": SysMode[this.sysMode]
        }, null, 2));
        */
    };
    return SystemState;
}());
exports.SystemState = SystemState;
//# sourceMappingURL=SystemState.js.map